import { RUN_SHORTCUT_LABEL } from '../lib/console'

interface Props {
  running: boolean // 내가 실행 중인지
  disabledReason: string | null // 실행할 수 없는 이유 (없으면 실행 가능)
  canClear: boolean
  onRun: () => void
  onStop: () => void
  onClear: () => void
}

export default function RunToolbar({ running, disabledReason, canClear, onRun, onStop, onClear }: Props) {
  return (
    <div className="run-toolbar">
      <button
        className="btn small run"
        onClick={onRun}
        disabled={running || disabledReason !== null}
        title={disabledReason ?? `실행 (${RUN_SHORTCUT_LABEL})`}
      >
        ▶ 실행
      </button>
      <button className="btn small" onClick={onStop} disabled={!running}>
        ■ 중지
      </button>
      <button className="btn small" onClick={onClear} disabled={!canClear}>
        콘솔 지우기
      </button>
      {disabledReason && !running && <span className="run-hint">{disabledReason}</span>}
    </div>
  )
}
