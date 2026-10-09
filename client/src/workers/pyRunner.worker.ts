// Python 실행용 Worker (Pyodide = 브라우저에서 돌아가는 Python).
// - Pyodide는 용량이 크므로 처음 실행할 때만 CDN에서 불러오고, 이후에는 같은 Worker에서 재사용한다.
// - 시간 초과/중지로 이 Worker를 terminate 하면 다음 실행 때 새로 불러온다. (메인 쪽에서 처리)
// - Pyodide는 모듈 Worker에서만 동작한다. (이 파일은 type: 'module' Worker로 만든다)

const PYODIDE_VERSION = 'v314.0.7'
const PYODIDE_URL = `https://cdn.jsdelivr.net/pyodide/${PYODIDE_VERSION}/full/pyodide.mjs`

interface PyodideLike {
  globals: { get(name: string): (...args: unknown[]) => PyProxyLike }
  setStdout(options: { batched: (line: string) => void }): void
  setStderr(options: { batched: (line: string) => void }): void
  runPython(code: string): unknown
  runPythonAsync(code: string, options?: { globals: PyProxyLike }): Promise<unknown>
}
interface PyProxyLike {
  destroy(): void
}

const ctx = self as unknown as {
  postMessage(message: unknown): void
  onmessage: ((event: MessageEvent) => void) | null
}

const out = (kind: 'log' | 'error', text: string) => ctx.postMessage({ type: 'out', kind, text })

let pyodide: PyodideLike | null = null

// input()은 사용할 수 없으므로 호출하면 안내 메시지와 함께 오류가 나게 바꿔 둔다.
const INPUT_PATCH = `
import builtins

def _unsupported_input(*args, **kwargs):
    raise RuntimeError("이 콘솔에서는 input()을 지원하지 않습니다. 값을 코드에 직접 적어 주세요.")

builtins.input = _unsupported_input
`

async function loadRuntime() {
  ctx.postMessage({ type: 'phase', phase: 'preparing' })
  // 번들러가 건드리지 않도록 URL을 변수로 두고 런타임에 불러온다.
  const { loadPyodide } = await import(/* @vite-ignore */ PYODIDE_URL)
  const py: PyodideLike = await loadPyodide()
  py.setStdout({ batched: (line) => out('log', line) })
  py.setStderr({ batched: (line) => out('error', line) })
  // 다른 파일명(<input-patch>)으로 컴파일해 두면, 오류 시 이 함수의 프레임이 Traceback에서 걸러진다.
  py.runPython(`exec(compile(${JSON.stringify(INPUT_PATCH)}, "<input-patch>", "exec"))`)
  pyodide = py
}

// Pyodide가 돌려주는 Traceback에서 내부 프레임(/lib/python..., _pyodide)을 빼고,
// 사용자 코드(<exec>)는 보기 좋게 main.py로 바꾼다.
function cleanTraceback(message: string): string {
  const lines = message.replace(/\s+$/, '').split('\n')
  const result: string[] = []
  let skipping = false
  for (const line of lines) {
    if (line.startsWith('  File "')) {
      skipping = !line.startsWith('  File "<exec>"')
      if (!skipping) result.push(line.replace('"<exec>"', '"main.py"'))
    } else if (skipping && line.startsWith('    ')) {
      continue // 내부 프레임에 딸린 코드/화살표 줄
    } else {
      skipping = false
      result.push(line)
    }
  }
  return result.join('\n')
}

async function run(code: string) {
  try {
    if (!pyodide) await loadRuntime()
  } catch (error) {
    out('error', `Python(Pyodide)을 불러오지 못했습니다. 인터넷 연결을 확인해 주세요. (${(error as Error).message})`)
    // fatal: 메인이 이 Worker를 버리고 다음 실행 때 새로 만들게 한다.
    ctx.postMessage({ type: 'done', ok: false, fatal: true })
    return
  }

  const py = pyodide as PyodideLike
  ctx.postMessage({ type: 'phase', phase: 'running' })

  // 실행마다 새 전역 공간을 만들어, 이전 실행의 변수가 남지 않게 한다. (스크립트를 처음부터 실행하는 것과 같다)
  const globals = py.globals.get('dict')()
  let ok = true
  try {
    await py.runPythonAsync(code, { globals })
  } catch (error) {
    ok = false
    out('error', cleanTraceback((error as Error).message))
  } finally {
    globals.destroy()
    try {
      // 줄바꿈 없이 끝난 출력(예: print(..., end=""))도 내보낸다.
      py.runPython('import sys; sys.stdout.flush(); sys.stderr.flush()')
    } catch {
      // 무시
    }
  }
  ctx.postMessage({ type: 'done', ok })
}

ctx.onmessage = (event: MessageEvent<{ type: 'run'; code: string }>) => {
  if (event.data.type === 'run') void run(event.data.code)
}
