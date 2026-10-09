import { useCallback, useEffect, useRef, useState } from 'react'
import type * as Y from 'yjs'
import jsPrelude from '../workers/jsPrelude.js?raw'
import type { RunningInfo } from './usePresence'
import type { ConsoleUser } from '../lib/console'
import { OUTPUT_FLOOD_KILL_LIMIT, RUN_TIMEOUT_MS } from '../lib/console'
import { createRunWriter } from '../lib/sharedConsole'
import type { RunWriter } from '../lib/sharedConsole'

export type RunStatus = 'idle' | 'preparing' | 'running'
export type RunLanguage = 'javascript' | 'python'

interface Options {
  ydoc: Y.Doc | null
  user: ConsoleUser
  setRunning: (info: RunningInfo | null) => void
}

type EndReason = 'ok' | 'error' | 'stopped' | 'timeout' | 'flood'

// 실행 한 번에 대한 정보. 늦게 도착한 Worker 메시지를 구분하는 데 쓴다.
interface Session {
  language: RunLanguage
  writer: RunWriter
  startedAt: number // 실제 실행이 시작된 시각 (Python 준비 시간 제외)
  startedAtWall: number
  done: boolean
  timer: ReturnType<typeof setTimeout> | null
  cleanup: () => void // 이 실행에서 만든 Worker/URL 정리
}

type WorkerMessage =
  | { type: 'out'; kind: 'log' | 'info' | 'warn' | 'error'; text: string }
  | { type: 'phase'; phase: 'preparing' | 'running' }
  | { type: 'done'; ok: boolean; fatal?: boolean }

// 사용자 코드는 async 함수로 감싸서 최상위 await도 쓸 수 있게 한다.
// 감싸는 코드는 1번째 줄에 같이 두므로, 사용자 코드는 항상 2번째 줄부터 시작한다.
// (jsPrelude.js의 LINE_OFFSET과 반드시 같아야 한다)
function buildJsSource(code: string, preludeUrl: string) {
  return (
    `importScripts(${JSON.stringify(preludeUrl)});(async()=>{\n` +
    `${code}\n` +
    `})().then(()=>self.__runnerFinish(),(e)=>self.__runnerFail(e))`
  )
}

// Worker의 메시지/오류 핸들러를 연결한다.
function bindWorker(
  worker: Worker,
  onMessage: (message: WorkerMessage) => void,
  onError: (event: ErrorEvent) => void,
) {
  worker.onmessage = (e: MessageEvent<WorkerMessage>) => onMessage(e.data)
  worker.onerror = onError
}

const ELAPSED = (ms: number) => (ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(2)}초`)

// 코드 실행을 관리한다: Worker 생성/종료, 5초 시간 제한, 출력 → 공유 콘솔 기록, 실행 상태 알림.
export function useCodeRunner({ ydoc, user, setRunning }: Options) {
  const [status, setStatus] = useState<RunStatus>('idle')
  const sessionRef = useRef<Session | null>(null)
  const pyWorkerRef = useRef<Worker | null>(null)
  const userRef = useRef(user)
  const setRunningRef = useRef(setRunning)
  useEffect(() => {
    userRef.current = user
    setRunningRef.current = setRunning
  })

  // 실행을 끝낸다. (정상 종료, 오류, 중지, 시간 초과 모두 여기로 모인다)
  const finish = useCallback((reason: EndReason, extra?: { killPython?: boolean }) => {
    const session = sessionRef.current
    if (!session || session.done) return
    session.done = true
    sessionRef.current = null
    if (session.timer) clearTimeout(session.timer)

    const elapsed = ELAPSED(performance.now() - session.startedAt)
    const messages: Record<EndReason, string> = {
      ok: `완료 · ${elapsed}`,
      error: `오류로 종료 · ${elapsed}`,
      stopped: `중지됨 · ${elapsed}`,
      timeout: `시간 초과로 중지됨 (${RUN_TIMEOUT_MS / 1000}초 제한) · ${elapsed}`,
      flood: `출력이 너무 많아 중지됨 · ${elapsed}`,
    }
    session.writer.push('system', messages[reason])
    session.writer.close()

    // JS Worker는 실행마다 새로 만들므로 항상 정리한다.
    // Python Worker는 정상 종료 시 재사용하고, 강제로 끊은 경우에만 버려 다음에 다시 불러온다.
    session.cleanup()
    if (session.language === 'python' && (reason !== 'ok' && reason !== 'error' || extra?.killPython)) {
      pyWorkerRef.current?.terminate()
      pyWorkerRef.current = null
    }

    setStatus('idle')
    setRunningRef.current(null)
  }, [])

  const handleMessage = useCallback(
    (session: Session, message: WorkerMessage) => {
      if (session.done) return // 이미 끝난 실행의 늦은 메시지는 무시
      if (message.type === 'out') {
        session.writer.push(message.kind, message.text)
        if (session.writer.discarded > OUTPUT_FLOOD_KILL_LIMIT) finish('flood')
      } else if (message.type === 'phase') {
        if (message.phase === 'preparing') {
          setStatus('preparing')
          setRunningRef.current({ phase: 'preparing', lang: session.language, startedAt: session.startedAtWall })
          session.writer.push('system', 'Python 준비 중... (처음 한 번만 오래 걸립니다)')
        } else {
          // 실제 실행이 시작된 시점부터 시간을 잰다. (준비 시간은 제한에 포함하지 않음)
          session.startedAt = performance.now()
          setStatus('running')
          setRunningRef.current({ phase: 'running', lang: session.language, startedAt: session.startedAtWall })
          if (session.timer) clearTimeout(session.timer)
          session.timer = setTimeout(() => finish('timeout'), RUN_TIMEOUT_MS)
        }
      } else if (message.type === 'done') {
        finish(message.ok ? 'ok' : 'error', { killPython: message.fatal })
      }
    },
    [finish],
  )

  const run = useCallback(
    (code: string, language: RunLanguage) => {
      if (!ydoc || sessionRef.current) return
      const writer = createRunWriter(ydoc, userRef.current, language)
      const session: Session = {
        language,
        writer,
        startedAt: performance.now(),
        startedAtWall: Date.now(),
        done: false,
        timer: null,
        cleanup: () => {},
      }
      sessionRef.current = session

      if (language === 'javascript') {
        // 사용자 코드를 Worker의 본문(스크립트)으로 직접 실행한다.
        // 이렇게 하면 문법 오류와 실행 오류 모두 브라우저가 알려 주는 줄 번호를 쓸 수 있다.
        const preludeUrl = URL.createObjectURL(new Blob([jsPrelude], { type: 'text/javascript' }))
        const mainUrl = URL.createObjectURL(
          new Blob([buildJsSource(code, preludeUrl)], { type: 'text/javascript' }),
        )
        const worker = new Worker(mainUrl)
        session.cleanup = () => {
          worker.terminate() // 중지/시간 초과 시 즉시 강제 종료된다.
          URL.revokeObjectURL(preludeUrl)
          URL.revokeObjectURL(mainUrl)
        }
        // 문법 오류, 타이머 안에서 난 오류 등 Worker 밖으로 새어 나온 오류도 여기서 받는다.
        bindWorker(
          worker,
          (message) => handleMessage(session, message),
          (e) => {
            e.preventDefault()
            if (session.done) return
            const message = e.message.replace(/^Uncaught\s+/, '')
            const line = e.lineno - 1 // 1번째 줄은 감싸는 코드
            const lineCount = code.split('\n').length
            const where = line >= 1 && line <= lineCount ? ` (줄 ${line})` : ''
            writer.push('error', `${message}${where}`)
            finish('error')
          },
        )
        handleMessage(session, { type: 'phase', phase: 'running' })
      } else {
        let worker = pyWorkerRef.current
        if (!worker) {
          worker = new Worker(new URL('../workers/pyRunner.worker.ts', import.meta.url), { type: 'module' })
          pyWorkerRef.current = worker
        }
        // Worker는 실행 사이에 재사용하므로, 실행할 때마다 핸들러를 현재 실행(session)에 연결한다.
        bindWorker(
          worker,
          (message) => handleMessage(session, message),
          (e) => {
            e.preventDefault()
            if (session.done) return
            writer.push('error', `Python Worker 오류: ${e.message}`)
            finish('error', { killPython: true })
          },
        )
        // 준비/실행 단계는 Worker가 phase 메시지로 알려 준다.
        setStatus('preparing')
        worker.postMessage({ type: 'run', code })
      }
    },
    [ydoc, handleMessage, finish],
  )

  const stop = useCallback(() => finish('stopped'), [finish])

  // 방을 나가거나 컴포넌트가 사라지면 실행 중인 Worker를 모두 정리한다.
  useEffect(
    () => () => {
      const session = sessionRef.current
      if (session && !session.done) {
        session.done = true
        if (session.timer) clearTimeout(session.timer)
        session.writer.push('system', '연결이 끊겨 중지됨')
        session.writer.close()
        session.cleanup()
        sessionRef.current = null
      }
      pyWorkerRef.current?.terminate()
      pyWorkerRef.current = null
    },
    [],
  )

  return { status, run, stop }
}
