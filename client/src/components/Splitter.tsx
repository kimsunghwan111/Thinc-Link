import type { KeyboardEvent, PointerEvent } from 'react'

interface Props {
  // 포인터의 세로 위치(clientY)를 받아 콘솔 높이를 정하는 쪽에서 처리한다.
  onDrag: (clientY: number) => void
  onNudge: (deltaPx: number) => void
}

// 편집기와 콘솔 사이의 경계. 마우스/터치로 끌거나 방향키로 높이를 조절한다.
export default function Splitter({ onDrag, onNudge }: Props) {
  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    // 포인터 캡처: 경계 밖으로 포인터가 나가거나 편집기 위를 지나도 드래그가 계속된다.
    e.currentTarget.setPointerCapture(e.pointerId)
    e.preventDefault()
  }
  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) onDrag(e.clientY)
  }
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowUp') onNudge(24)
    else if (e.key === 'ArrowDown') onNudge(-24)
    else return
    e.preventDefault()
  }

  return (
    <div
      className="splitter"
      role="separator"
      aria-orientation="horizontal"
      aria-label="콘솔 높이 조절"
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onKeyDown={handleKeyDown}
    />
  )
}
