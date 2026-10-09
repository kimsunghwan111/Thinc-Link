import { useEffect, useState } from 'react'
import type { HocuspocusProvider } from '@hocuspocus/provider'

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

// provider의 'status' 이벤트를 구독해 서버 연결 상태를 알려 준다.
// 연결이 끊기면 provider가 자동으로 재연결을 시도한다.
export function useConnectionStatus(provider: HocuspocusProvider | null) {
  const [status, setStatus] = useState<ConnectionStatus>('connecting')

  useEffect(() => {
    if (!provider) return
    const onStatus = ({ status }: { status: ConnectionStatus }) => setStatus(status)
    provider.on('status', onStatus)
    return () => {
      provider.off('status', onStatus)
    }
  }, [provider])

  return status
}
