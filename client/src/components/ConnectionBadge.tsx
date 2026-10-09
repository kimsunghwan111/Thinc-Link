import type { ConnectionStatus } from '../hooks/useConnectionStatus'

const LABELS: Record<ConnectionStatus, string> = {
  connected: '연결됨',
  connecting: '연결 중',
  disconnected: '끊김',
}

export default function ConnectionBadge({ status }: { status: ConnectionStatus }) {
  return (
    <span className={`conn conn-${status}`} role="status">
      <i className="dot" />
      {LABELS[status]}
    </span>
  )
}
