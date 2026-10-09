import { useState } from 'react'
import type { Participant } from '../hooks/usePresence'
import { MAX_NAME_LENGTH, sanitizeName } from '../lib/user'

interface Props {
  participants: Participant[]
  myName: string
  onRename: (name: string) => void
}

export default function PresenceBar({ participants, myName, onRename }: Props) {
  const [draft, setDraft] = useState<string | null>(null)

  // 편집이 끝나면(Enter/포커스 해제) 이름을 확정한다. 빈 값이면 기존 이름을 유지한다.
  const commit = () => {
    const name = sanitizeName(draft ?? '')
    if (name && name !== myName) onRename(name)
    setDraft(null)
  }

  return (
    <div className="presence">
      {participants.map((p) => (
        <span className="participant" key={p.clientId} title={p.name}>
          <i className="dot" style={{ background: p.color }} />
          {p.isMe ? (
            <input
              className="name-input"
              value={draft ?? myName}
              maxLength={MAX_NAME_LENGTH}
              size={Math.max((draft ?? myName).length, 3)}
              aria-label="내 닉네임"
              onFocus={() => setDraft(myName)}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
                if (e.key === 'Escape') {
                  setDraft(null)
                  e.currentTarget.blur()
                }
              }}
            />
          ) : (
            p.name
          )}
          {p.isMe && <span className="me-tag">(나)</span>}
        </span>
      ))}
    </div>
  )
}
