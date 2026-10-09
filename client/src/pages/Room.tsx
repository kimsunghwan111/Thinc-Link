import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import CollabEditor from '../components/CollabEditor'
import ConsolePanel from '../components/ConsolePanel'
import ConnectionBadge from '../components/ConnectionBadge'
import CopyLinkButton from '../components/CopyLinkButton'
import LanguageSelect from '../components/LanguageSelect'
import PresenceBar from '../components/PresenceBar'
import RemoteCursorStyles from '../components/RemoteCursorStyles'
import RunToolbar from '../components/RunToolbar'
import Splitter from '../components/Splitter'
import { useCollabRoom } from '../hooks/useCollabRoom'
import { useCodeRunner } from '../hooks/useCodeRunner'
import { useConnectionStatus } from '../hooks/useConnectionStatus'
import { usePresence } from '../hooks/usePresence'
import { useSharedConsole } from '../hooks/useSharedConsole'
import { useSharedLanguage } from '../hooks/useSharedLanguage'
import { isRunnable, languageLabel } from '../lib/languages'
import { clearConsole } from '../lib/sharedConsole'
import { getLocalUser, saveUser } from '../lib/user'

const CONSOLE_HEIGHT_KEY = 'console-height'
const DEFAULT_CONSOLE_HEIGHT = 220
const MIN_CONSOLE_HEIGHT = 60
// 편집기가 최소한 이만큼은 보이도록 콘솔 최대 높이를 제한한다.
const MIN_EDITOR_HEIGHT = 126 // 경계선(6px) 포함

function loadConsoleHeight() {
  try {
    const saved = Number(localStorage.getItem(CONSOLE_HEIGHT_KEY))
    if (saved >= MIN_CONSOLE_HEIGHT) return saved
  } catch {
    // 저장소를 쓸 수 없으면 기본값을 쓴다.
  }
  return DEFAULT_CONSOLE_HEIGHT
}

export default function Room() {
  // URL(/room/:roomId)에서 방 ID를 읽는다.
  const { roomId } = useParams()
  return <RoomView key={roomId} roomId={roomId ?? ''} />
}

// key={roomId}: 다른 방으로 이동하면 컴포넌트가 새로 만들어져 이전 방 연결이 확실히 정리된다.
function RoomView({ roomId }: { roomId: string }) {
  const room = useCollabRoom(roomId)
  // 내 닉네임·색상: localStorage에 저장되어 새로고침해도 유지된다.
  const [user, setUser] = useState(getLocalUser)
  const { participants, setRunning } = usePresence(room?.provider ?? null, user)
  const status = useConnectionStatus(room?.provider ?? null)
  const [language, setLanguage] = useSharedLanguage(room?.ydoc ?? null)

  // --- 콘솔: 실행 결과는 Y.Array("console")에 쌓여 방 전체에 공유된다 ---
  const entries = useSharedConsole(room?.ydoc ?? null)
  const runner = useCodeRunner({ ydoc: room?.ydoc ?? null, user, setRunning })
  const [consoleHeight, setConsoleHeight] = useState(loadConsoleHeight)
  const workspaceRef = useRef<HTMLDivElement>(null)

  // 누가 실행 중인지는 awareness로 모두가 안다. 한 번에 한 사람만 실행하도록 막는다.
  const activeParticipant = participants.find((p) => p.running)
  const activeRunner = activeParticipant?.running
    ? {
        name: activeParticipant.name,
        color: activeParticipant.color,
        phase: activeParticipant.running.phase,
        lang: activeParticipant.running.lang,
      }
    : null

  // 실행할 수 없는 이유 (null이면 실행 가능)
  let disabledReason: string | null = null
  if (!room) disabledReason = '서버에 연결하는 중...'
  else if (!isRunnable(language))
    disabledReason = `${languageLabel(language)} 실행은 지원하지 않습니다 (JavaScript, Python만 가능)`
  else if (activeParticipant && !activeParticipant.isMe)
    disabledReason = `${activeParticipant.name}님이 실행 중...`

  const handleRun = useCallback(() => {
    if (!room || runner.status !== 'idle' || disabledReason !== null || !isRunnable(language)) return
    // 실행할 코드는 항상 공유 문서(Y.Text)의 현재 내용이다. (모두가 같은 코드를 본다)
    runner.run(room.ydoc.getText('code').toString(), language)
  }, [room, runner, disabledReason, language])

  // Ctrl+Enter(맥은 Cmd+Enter)로 실행. 포커스가 어디에 있든 동작하도록 window에서 잡고,
  // capture 단계에서 막아 Monaco의 기본 동작("아래에 줄 삽입")이 함께 실행되지 않게 한다.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !e.isComposing) {
        e.preventDefault()
        e.stopPropagation()
        handleRun()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [handleRun])

  // 콘솔 높이 = 작업 영역 아래쪽 끝 - 포인터 위치. 최소/최대 범위로 제한한다.
  const resizeConsole = useCallback((height: number) => {
    const area = workspaceRef.current
    if (!area) return
    const max = Math.max(MIN_CONSOLE_HEIGHT, area.clientHeight - MIN_EDITOR_HEIGHT)
    const next = Math.round(Math.min(max, Math.max(MIN_CONSOLE_HEIGHT, height)))
    setConsoleHeight(next)
    try {
      localStorage.setItem(CONSOLE_HEIGHT_KEY, String(next))
    } catch {
      // 저장 실패는 무시한다.
    }
  }, [])

  const rename = (name: string) => {
    const next = { ...user, name }
    saveUser(next)
    setUser(next)
  }

  return (
    <div className="room">
      <header className="room-bar">
        <Link to="/" className="back">← 홈</Link>
        <span className="room-id">
          방 ID <code>{roomId}</code>
        </span>
        <LanguageSelect value={language} onChange={setLanguage} />
        <RunToolbar
          running={runner.status !== 'idle'}
          disabledReason={disabledReason}
          canClear={entries.length > 0 && room !== null}
          onRun={handleRun}
          onStop={runner.stop}
          onClear={() => room && clearConsole(room.ydoc)}
        />
        <CopyLinkButton />
        <ConnectionBadge status={status} />
        <PresenceBar participants={participants} myName={user.name} onRename={rename} />
      </header>
      <RemoteCursorStyles participants={participants} />
      <main className="workspace" ref={workspaceRef}>
        <div className="editor-area">
          {room && <CollabEditor ydoc={room.ydoc} provider={room.provider} language={language} />}
        </div>
        <Splitter
          onDrag={(clientY) => {
            const rect = workspaceRef.current?.getBoundingClientRect()
            if (rect) resizeConsole(rect.bottom - clientY)
          }}
          onNudge={(delta) => resizeConsole(consoleHeight + delta)}
        />
        <div className="console-wrap" style={{ height: consoleHeight }}>
          <ConsolePanel entries={entries} activeRunner={activeRunner} />
        </div>
      </main>
    </div>
  )
}
