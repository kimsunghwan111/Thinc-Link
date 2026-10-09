import { useEffect, useState } from 'react'
import type * as Y from 'yjs'
import type { ConsoleEntry } from '../lib/console'
import { getConsoleArray } from '../lib/sharedConsole'

// Y.Array("console")를 구독해 화면에 보여 줄 목록으로 돌려준다.
export function useSharedConsole(ydoc: Y.Doc | null): ConsoleEntry[] {
  const [entries, setEntries] = useState<ConsoleEntry[]>([])

  useEffect(() => {
    if (!ydoc) return
    const arr = getConsoleArray(ydoc)
    const update = () => setEntries(arr.toArray())
    arr.observe(update)
    update() // 접속 직후 서버에서 받은(저장된) 기록으로 시작한다.
    return () => arr.unobserve(update)
  }, [ydoc])

  return entries
}
