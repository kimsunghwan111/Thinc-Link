import { useEffect, useState } from 'react'
import * as Y from 'yjs'
import { HocuspocusProvider } from '@hocuspocus/provider'

const COLLAB_URL = import.meta.env.VITE_COLLAB_URL ?? 'ws://localhost:1234'

export interface CollabRoom {
  ydoc: Y.Doc
  provider: HocuspocusProvider
}

// 방 하나에 대한 Yjs 문서와 서버 연결을 만들고, 사라질 때 정리한다.
export function useCollabRoom(roomId: string): CollabRoom | null {
  const [room, setRoom] = useState<CollabRoom | null>(null)

  useEffect(() => {
    // 렌더 중이 아니라 effect 안에서 만든다. StrictMode가 effect를
    // "실행 → 정리 → 재실행"하더라도 정리 단계에서 destroy 하므로
    // 최종적으로 연결은 하나만 남는다.
    const ydoc = new Y.Doc()
    const provider = new HocuspocusProvider({
      url: COLLAB_URL,
      name: roomId, // 방 ID = Yjs 문서 이름
      document: ydoc,
    })
    setRoom({ ydoc, provider })

    return () => {
      setRoom(null)
      provider.destroy()
      ydoc.destroy()
    }
  }, [roomId])

  return room
}
