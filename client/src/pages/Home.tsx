import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { nanoid } from 'nanoid'

export default function Home() {
  const navigate = useNavigate()
  const [joinId, setJoinId] = useState('')

  // 새 방: 8자리 무작위 ID를 만들어 방 주소로 이동한다.
  // 이 ID가 이후 단계에서 Yjs 문서 이름이 된다.
  const createRoom = () => navigate(`/room/${nanoid(8)}`)

  // 기존 방: 입력한 ID(공백 제거)로 이동한다. 빈 값은 무시한다.
  const joinRoom = (e: FormEvent) => {
    e.preventDefault()
    const id = joinId.trim()
    if (id) navigate(`/room/${encodeURIComponent(id)}`)
  }

  return (
    <main className="home">
      <h1>코딩 회의방</h1>
      <p className="subtitle">링크 하나로 함께 코드를 편집하세요.</p>

      <button className="btn primary" onClick={createRoom}>
        방 만들기
      </button>

      <div className="divider">또는</div>

      <form className="join-form" onSubmit={joinRoom}>
        <input
          value={joinId}
          onChange={(e) => setJoinId(e.target.value)}
          placeholder="방 ID 입력"
          aria-label="방 ID"
        />
        <button className="btn" type="submit" disabled={!joinId.trim()}>
          입장
        </button>
      </form>
    </main>
  )
}
