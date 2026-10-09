import { useCallback, useEffect, useState } from 'react'
import type * as Y from 'yjs'
import { DEFAULT_LANGUAGE, isSupportedLanguage } from '../lib/languages'

// Y.Map: Yjs의 공유 키-값 저장소. 방 설정(언어)을 담아 모든 참여자에게 공유한다.
// 값을 바꿀 때는 Y.Map에만 쓰고, 화면은 Y.Map 변경(observe)을 읽어서 갱신한다.
// 한 방향으로만 흐르므로 내가 바꾼 값과 남이 바꾼 값이 같은 경로로 처리된다.
export function useSharedLanguage(ydoc: Y.Doc | null) {
  const [language, setLanguageState] = useState(DEFAULT_LANGUAGE)

  useEffect(() => {
    if (!ydoc) return
    const settings = ydoc.getMap<string>('settings')

    const read = () => {
      const value = settings.get('language')
      setLanguageState(isSupportedLanguage(value) ? value : DEFAULT_LANGUAGE)
    }
    settings.observe(read)
    read() // 늦게 입장해도 서버에서 받은 현재 값으로 시작한다.
    return () => settings.unobserve(read)
  }, [ydoc])

  const setLanguage = useCallback(
    (id: string) => {
      if (ydoc && isSupportedLanguage(id)) ydoc.getMap<string>('settings').set('language', id)
    },
    [ydoc],
  )

  return [language, setLanguage] as const
}
