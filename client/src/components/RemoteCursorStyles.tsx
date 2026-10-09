import type { Participant } from '../hooks/usePresence'

// y-monaco는 원격 커서에 클래스 이름만 붙인다. (모양은 직접 만들어야 한다)
//   .yRemoteSelection-<clientId>      : 선택 영역
//   .yRemoteSelectionHead-<clientId>  : 커서 위치(막대)
// 접속자마다 색상과 이름이 다르므로 clientId별 CSS를 동적으로 만든다.
export default function RemoteCursorStyles({ participants }: { participants: Participant[] }) {
  const css = participants
    .filter((p) => !p.isMe)
    .map(
      (p) => `
.yRemoteSelection-${p.clientId} {
  background: color-mix(in srgb, ${p.color} 30%, transparent);
}
.yRemoteSelectionHead-${p.clientId} {
  border-left-color: ${p.color};
}
.yRemoteSelectionHead-${p.clientId}::after {
  content: ${JSON.stringify(p.name)};
  background: ${p.color};
}`,
    )
    .join('\n')

  return <style>{css}</style>
}
