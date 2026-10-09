# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

"실시간 코딩 회의방" 데모: 방을 만들고 같은 방 링크로 접속한 사람들이 Monaco 편집기에서 코드를 동시에 편집한다. 범위는 방 만들기 + 공동 편집(참여자 표시, 언어 공유, 링크 복사, 연결 상태)과 방 내용 SQLite 저장, 라이브 콘솔까지이며, 로그인·음성 통화는 데모 범위 밖이다. 코드 실행은 브라우저 라이브 콘솔(JavaScript, Python)로 지원한다(서버에서는 코드를 실행하지 않는다).

- `ROADMAP.md`: 6단계 실행 순서(진행 규칙과 단계별 완료 확인 방법). 1~5단계는 구현 완료, **6단계(루트 README.md, concurrently 동시 실행 스크립트)는 미완료**.
- `README.md`: 실행·저장 파일 위치·초기화 방법(루트 동시 실행 스크립트는 6단계에서 추가 예정).
- `PLAN.md`: 아키텍처와 확장 계획. 단, 언어 목록(7종)과 이름 입력 방식은 구현(ROADMAP 기준 5종, 랜덤 닉네임)과 다르므로 `ROADMAP.md`가 우선한다.
- 한국어로 응답하고 주석·문서·커밋 메시지도 한국어로 쓴다. 오류가 나면 라이브러리를 임의로 바꾸지 말고 원인과 해결책을 먼저 설명한다.

## 명령어

루트 `package.json`은 아직 없다(워크스페이스가 아님). `client/`와 `server/`에서 각각 실행한다. 테스트 러너는 없다.

```bash
# 서버 (ws://localhost:1234)
cd server && npm run dev        # tsx watch (자동 재시작)
cd server && npm start          # 1회 실행
cd server && npm run typecheck

# 클라이언트 (http://localhost:5173)
cd client && npm run dev
cd client && npm run build      # tsc -b && vite build (타입 체크 겸용)
cd client && npm run lint       # oxlint
```

동작 확인은 두 서버를 띄우고 같은 `/room/:roomId`를 브라우저 두 탭으로 연다. 같은 브라우저의 탭은 localStorage를 공유해 닉네임·색상이 같으므로, 구분하려면 한쪽 닉네임을 바꾸거나 시크릿 창을 쓴다.

## 아키텍처

방 ID(`nanoid(8)`)가 URL `/room/:roomId`이자 Yjs 문서 이름이다. 서버는 같은 문서 이름으로 접속한 클라이언트끼리 Yjs 변경분을 중계하고, `@hocuspocus/extension-sqlite`가 문서 전체(코드 Y.Text + 설정 Y.Map)를 `server/rooms.sqlite`(gitignore 대상, 실행 위치와 무관하게 이 경로)에 저장해 서버 재시작 후에도 복원한다. 접속자·커서(awareness)는 저장되지 않는다. 저장 로직은 서버에만 있고 클라이언트는 관여하지 않는다.

- **server/src/index.ts**: `@hocuspocus/server` v4의 `new Server({ port })` + `listen()`. SQLite 확장과 접속/해제 로그를 설정한다. 정상 종료 신호에서는 미저장 변경분을 flush한다(`kill -9`는 마지막 몇 초 유실 가능). (v4는 구버전의 `Server.configure()`가 아니라 생성자 방식)
- **client 데이터 흐름**: `pages/Room.tsx`가 `hooks/useCollabRoom`으로 `Y.Doc` + `HocuspocusProvider`를 만들고, 그 결과를 작은 훅들이 나눠 쓴다.
  - `useCollabRoom`: provider/ydoc 생성·`destroy`를 한 곳에 모은다. 반드시 렌더가 아닌 `useEffect`에서 만들어야 StrictMode에서 연결이 중복되지 않는다. `Room`은 `key={roomId}`로 방 이동 시 완전히 재생성한다.
  - `components/CollabEditor`: Monaco 준비 후 `MonacoBinding(ydoc.getText('code'), model, editors, provider.awareness)`로 연결하고 cleanup에서 `binding.destroy()`.
  - `usePresence`: awareness의 `user`(이름·색상) 등록과 접속자 목록. 커서/선택은 y-monaco가 awareness에 자동으로 싣는다.
  - `useSharedLanguage`: `Y.Map('settings')`의 `language`. 쓰기는 Y.Map에만 하고 화면은 `observe`로 읽는 단방향 구조.
  - `useConnectionStatus`: provider `status` 이벤트(connecting/connected/disconnected).
- **라이브 콘솔**(`server/` 수정 없음): 실행은 항상 실행한 사람의 브라우저에서만 일어난다.
  - `hooks/useCodeRunner`가 Worker 생성/종료, 5초 제한, 출력 → 공유 콘솔 기록, awareness `running` 알림을 모두 맡는다. 실행할 코드는 `ydoc.getText('code')`의 현재 내용이다.
  - **JavaScript**: 실행마다 새 **Blob 클래식 Worker**를 만든다. 본문은 `importScripts(prelude);(async()=>{\n<사용자 코드>\n})()...` 형태이며 사용자 코드는 항상 **2번째 줄부터** 시작한다. 문법·실행 오류의 줄 번호는 `lineno - 1`/스택에서 얻은 값에서 1을 뺀 것이므로, `workers/jsPrelude.js`의 `LINE_OFFSET`과 `useCodeRunner`의 `buildJsSource`/`onerror` 계산이 반드시 같아야 한다. `jsPrelude.js`는 console 가로채기, 값 직렬화, 타이머/fetch 대기 추적을 담당하는 클래식 스크립트(`?raw` import)다.
  - **Python**: `workers/pyRunner.worker.ts`(모듈 Worker, Pyodide `v314.0.7`을 jsDelivr에서 동적 import). Worker는 실행 사이에 재사용하고, 중지/시간 초과 시 terminate 해서 다음 실행에 다시 불러온다. `input()`은 오류로 대체했고, Traceback은 내부 프레임을 제거하고 `<exec>`를 `main.py`로 바꿔 보여 준다.
  - **공유**: 출력은 `Y.Array('console')`에 `ConsoleEntry` 객체로 쌓인다(`lib/sharedConsole.ts`의 `createRunWriter`: 100ms 단위 배치, 실행당 1000줄·방 전체 500줄 제한). 한 번에 한 명만 실행하도록 awareness의 `running` 필드를 쓴다(`usePresence`의 `setRunning`). 콘솔 출력은 항상 텍스트로만 렌더링한다(다른 사람이 만든 내용).
  - 단축키(Ctrl/Cmd+Enter)는 `Room.tsx`에서 `window` capture 단계로 처리한다(Monaco 기본 동작과 겹치지 않게).
- **원격 커서 스타일**: y-monaco는 `yRemoteSelection-<clientId>`, `yRemoteSelectionHead-<clientId>` 클래스만 붙인다. 공통 모양은 `index.css`, 접속자별 색상·이름 라벨은 `components/RemoteCursorStyles`가 `<style>`로 동적 생성한다.
- 내 닉네임·색상은 `lib/user.ts`가 localStorage(`collab-user`)에 저장하며, 이름은 CSS 라벨에도 쓰이므로 `sanitizeName`을 거친다.

## 반드시 알아둘 설정 (monaco-editor 0.57 호환)

- monaco-editor 0.57은 `exports` 매핑이 바뀌어 `monaco-editor/esm/vs/...` 경로가 풀리지 않는다. 워커 import는 `monaco-editor/editor/editor.worker?worker`처럼 `esm/vs/` 없이 쓴다(`client/src/lib/monaco.ts`).
- y-monaco 0.1.6이 옛 경로 `monaco-editor/esm/vs/editor/editor.api.js`를 import하므로 `client/vite.config.ts`의 alias로 실제 파일에 연결한다. 이 alias는 y-monaco와 편집기가 같은 Monaco 인스턴스를 쓰게 하는 역할도 한다. 제거하면 빌드가 실패한다.
- `@monaco-editor/react`가 CDN 대신 번들한 Monaco를 쓰도록 `loader.config({ monaco })`를 `lib/monaco.ts`에서 호출한다. `CollabEditor`가 이 파일을 import하므로 지우면 안 된다.
- 서버 주소는 `VITE_COLLAB_URL`(기본 `ws://localhost:1234`).
- `oxlint`의 `react(set-state-in-effect)` 경고 1건(`useCollabRoom`의 `setRoom`)은 의도된 패턴이라 남겨 둔다.
