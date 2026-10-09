// 콘솔 한 줄. Y.Array("console")에 이 형태의 평범한 객체로 저장된다.
//  - 'start' : 실행 시작 표시(실행자·시각·언어). 실행마다 맨 앞에 한 줄 들어간다.
//  - 'log' | 'info' | 'warn' | 'error' : 실행 중 출력
//  - 'system': 완료/중지/시간 초과 같은 안내
export type ConsoleKind = 'start' | 'log' | 'info' | 'warn' | 'error' | 'system'

export interface ConsoleUser {
  name: string
  color: string
}

export interface ConsoleEntry {
  id: string
  runId: string
  kind: ConsoleKind
  text: string
  time: number // 밀리초 타임스탬프
  user?: ConsoleUser // 'start' 항목에만 들어 있다.
  lang?: string // 'start' 항목에만 들어 있다.
}

export const MAX_ENTRIES = 500 // 방 전체 기록은 최근 500줄까지만 유지
export const MAX_LINES_PER_RUN = 1000 // 한 번 실행에서 저장하는 최대 줄 수
export const MAX_LINE_LENGTH = 5000 // 한 줄 최대 글자 수 (넘으면 잘라서 저장)
export const FLUSH_INTERVAL_MS = 100 // 출력을 모아서 Yjs에 쓰는 간격
export const RUN_TIMEOUT_MS = 5000 // 실행 시간 제한
// 출력 한도를 넘긴 뒤에도 이만큼 더 쏟아내면 폭주로 보고 강제 종료한다.
export const OUTPUT_FLOOD_KILL_LIMIT = 20000

// Mac은 Cmd, 그 외는 Ctrl을 단축키 안내에 쓴다.
export const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform)
export const RUN_SHORTCUT_LABEL = IS_MAC ? '⌘ Enter' : 'Ctrl Enter'
