import { useCallback, useEffect, useState } from 'react'
import type { HocuspocusProvider } from '@hocuspocus/provider'
import type { LocalUser } from '../lib/user'

// 코드 실행 중이라는 임시 상태. awareness에 실어 모두에게 보여 준다.
// 접속이 끊기면 awareness가 자동으로 지워지므로, 실행자가 나가도 "실행 중" 표시가 남지 않는다.
export interface RunningInfo {
  phase: 'preparing' | 'running'
  lang: string
  startedAt: number
}

export interface Participant extends LocalUser {
  clientId: number
  isMe: boolean
  running?: RunningInfo
}

// awareness: 접속자의 "임시 상태"(이름·색상·커서)를 공유하는 Yjs 기능.
// 내 정보를 등록하고, 방 안의 모든 접속자 목록을 돌려준다.
export function usePresence(provider: HocuspocusProvider | null, user: LocalUser) {
  const [participants, setParticipants] = useState<Participant[]>([])
  const { name, color } = user

  // 내 정보를 awareness에 등록한다. 이름을 바꾸면 다시 등록되어 모두에게 갱신된다.
  useEffect(() => {
    provider?.awareness?.setLocalStateField('user', { name, color })
  }, [provider, name, color])

  // awareness가 바뀔 때(입장/퇴장/정보 변경)마다 접속자 목록을 다시 만든다.
  useEffect(() => {
    const awareness = provider?.awareness
    if (!provider || !awareness) return

    const update = () => {
      const list: Participant[] = []
      awareness.getStates().forEach((state, clientId) => {
        const u = state.user as LocalUser | undefined
        if (!u) return
        list.push({
          clientId,
          name: u.name,
          color: u.color,
          isMe: clientId === awareness.clientID,
          running: (state.running as RunningInfo | null | undefined) ?? undefined,
        })
      })
      // 나를 맨 앞에, 나머지는 입장 순서(clientId 기준)로 정렬한다.
      list.sort((a, b) => Number(b.isMe) - Number(a.isMe) || a.clientId - b.clientId)
      setParticipants(list)
    }

    awareness.on('change', update)
    update()
    return () => awareness.off('change', update)
  }, [provider])

  // 내 실행 상태를 알린다. null이면 실행 중이 아님.
  const setRunning = useCallback(
    (info: RunningInfo | null) => provider?.awareness?.setLocalStateField('running', info),
    [provider],
  )

  return { participants, setRunning }
}
