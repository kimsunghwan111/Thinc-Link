import { useEffect, useState } from 'react'

type CopyState = 'idle' | 'copied' | 'failed'

export default function CopyLinkButton() {
  const [state, setState] = useState<CopyState>('idle')

  // 알림은 2초 뒤 사라진다. 컴포넌트가 사라지면 타이머도 정리한다.
  useEffect(() => {
    if (state === 'idle') return
    const timer = setTimeout(() => setState('idle'), 2000)
    return () => clearTimeout(timer)
  }, [state])

  const copy = async () => {
    try {
      // 클립보드 API는 localhost 또는 HTTPS에서만 동작한다.
      await navigator.clipboard.writeText(window.location.href)
      setState('copied')
    } catch {
      setState('failed')
    }
  }

  return (
    <span className="copy-wrap">
      <button className="btn small" onClick={copy}>
        링크 복사
      </button>
      {state !== 'idle' && (
        <span className={`toast ${state}`} role="status">
          {state === 'copied' ? '링크가 복사되었습니다' : '복사에 실패했습니다'}
        </span>
      )}
    </span>
  )
}
