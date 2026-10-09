import { nanoid } from 'nanoid'
import type * as Y from 'yjs'
import type { ConsoleEntry, ConsoleKind, ConsoleUser } from './console'
import {
  FLUSH_INTERVAL_MS,
  MAX_ENTRIES,
  MAX_LINE_LENGTH,
  MAX_LINES_PER_RUN,
} from './console'

// 콘솔 기록은 Y.Array("console")에 쌓는다. 같은 문서에 있으므로
// 서버(SQLite 확장)가 코드·언어와 함께 저장하고, 방의 모든 참여자에게 실시간으로 전달된다.
export const getConsoleArray = (ydoc: Y.Doc) => ydoc.getArray<ConsoleEntry>('console')

// 모든 참여자 화면에서 콘솔을 지운다.
export function clearConsole(ydoc: Y.Doc) {
  const arr = getConsoleArray(ydoc)
  arr.delete(0, arr.length)
}

export interface RunWriter {
  readonly runId: string
  /** 한도를 넘겨서 버려진 줄 수 */
  readonly discarded: number
  push(kind: ConsoleKind, text: string): void
  /** 모아 둔 출력을 즉시 Yjs에 쓴다. 이후에는 push해도 무시된다. */
  close(): void
}

// 실행 한 번의 출력을 Yjs에 쓰는 도우미.
//  - 줄마다 바로 쓰지 않고 FLUSH_INTERVAL_MS 동안 모아서 한 번의 transaction으로 쓴다.
//    (출력이 많아도 네트워크/저장 부담이 커지지 않는다.)
//  - 한 번 실행에서 MAX_LINES_PER_RUN줄까지만 저장하고, 넘으면 안내 한 줄만 남기고 버린다.
//  - 쓸 때마다 전체 기록이 MAX_ENTRIES를 넘으면 앞쪽(오래된 것)부터 지운다.
export function createRunWriter(ydoc: Y.Doc, user: ConsoleUser, lang: string): RunWriter {
  const arr = getConsoleArray(ydoc)
  const runId = nanoid(8)
  let seq = 0
  let lines = 0
  let discarded = 0
  let truncated = false
  let closed = false
  let buffer: ConsoleEntry[] = []
  let timer: ReturnType<typeof setTimeout> | null = null

  const make = (kind: ConsoleKind, text: string, extra?: Partial<ConsoleEntry>): ConsoleEntry => ({
    id: `${runId}:${seq++}`,
    runId,
    kind,
    text,
    time: Date.now(),
    ...extra,
  })

  const flush = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    if (buffer.length === 0) return
    const batch = buffer
    buffer = []
    ydoc.transact(() => {
      arr.push(batch)
      const over = arr.length - MAX_ENTRIES
      if (over > 0) arr.delete(0, over)
    })
  }

  const schedule = () => {
    if (!timer) timer = setTimeout(flush, FLUSH_INTERVAL_MS)
  }

  // 실행 시작 줄은 바로 보이도록 즉시 쓴다.
  buffer.push(make('start', '', { user, lang }))
  flush()

  return {
    runId,
    get discarded() {
      return discarded
    },
    push(kind, text) {
      if (closed) return
      if (kind !== 'system' && lines >= MAX_LINES_PER_RUN) {
        if (!truncated) {
          truncated = true
          buffer.push(make('system', `출력이 너무 많아 일부 생략됨 (최대 ${MAX_LINES_PER_RUN}줄)`))
          schedule()
        }
        discarded++
        return
      }
      if (kind !== 'system') lines++
      const clipped =
        text.length > MAX_LINE_LENGTH ? `${text.slice(0, MAX_LINE_LENGTH)}… (이하 생략)` : text
      buffer.push(make(kind, clipped))
      schedule()
    },
    close() {
      if (closed) return
      flush()
      closed = true
    },
  }
}
