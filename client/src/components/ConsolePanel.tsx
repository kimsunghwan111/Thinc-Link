import { useEffect, useRef } from 'react'
import type { ConsoleEntry } from '../lib/console'
import { RUN_SHORTCUT_LABEL } from '../lib/console'
import { languageLabel } from '../lib/languages'

const formatTime = (t: number) => new Date(t).toLocaleTimeString('ko-KR', { hour12: false })

interface Props {
  entries: ConsoleEntry[]
  // 지금 코드를 실행 중인 사람(없으면 null). 모든 참여자 화면에 같이 보인다.
  activeRunner: { name: string; color: string; phase: 'preparing' | 'running'; lang: string } | null
}

// 출력은 항상 텍스트로만 렌더링한다. (다른 참여자가 만든 내용이므로 HTML로 해석하지 않는다)
export default function ConsolePanel({ entries, activeRunner }: Props) {
  const endRef = useRef<HTMLDivElement>(null)
  const lastId = entries.at(-1)?.id

  // 새 줄이 생기면 맨 아래로 스크롤한다. (기록이 500줄로 꽉 차 있어도 마지막 줄 기준으로 동작)
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [lastId])

  return (
    <section className="console" aria-label="콘솔">
      <div className="console-title">
        <span>콘솔</span>
        {activeRunner && (
          <span className="console-running" role="status">
            <i className="dot" style={{ background: activeRunner.color }} />
            {activeRunner.phase === 'preparing'
              ? `${activeRunner.name}님이 ${languageLabel(activeRunner.lang)} 준비 중...`
              : `${activeRunner.name}님이 실행 중...`}
          </span>
        )}
      </div>
      <div className="console-body">
        {entries.length === 0 ? (
          <p className="console-empty">
            출력이 없습니다. 코드를 실행하면 같은 방 모든 참여자에게 결과가 표시됩니다. ({RUN_SHORTCUT_LABEL})
          </p>
        ) : (
          entries.map((e) =>
            e.kind === 'start' ? (
              <div className="console-run-header" key={e.id}>
                <i className="dot" style={{ background: e.user?.color }} />
                <strong>{e.user?.name}</strong>
                <span>
                  {formatTime(e.time)} · {languageLabel(e.lang ?? '')} 실행
                </span>
              </div>
            ) : (
              <div className={`console-line ${e.kind}`} key={e.id}>
                {e.text}
              </div>
            ),
          )
        )}
        <div ref={endRef} />
      </div>
    </section>
  )
}
