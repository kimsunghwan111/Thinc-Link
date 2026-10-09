# 실시간 코딩 회의방 — 데모 개발 계획서

> 이번 단계 범위: **방 만들기 + 실시간 공동 편집**
> 이 문서는 계획서이며, 아직 코드는 작성하지 않는다.

## 0. 확정 사항

| 항목 | 결정 |
|---|---|
| 프론트엔드 | Vite + React + TypeScript |
| 편집기 | Monaco Editor (`@monaco-editor/react`) |
| 동기화 | Yjs + y-monaco |
| 동기화 서버 | Hocuspocus (`@hocuspocus/server`, `@hocuspocus/provider`) |
| 라우팅 / 방 ID | React Router + nanoid (방 ID = Yjs 문서 이름) |
| DB | 사용하지 않음 (서버 메모리에만 보관, 서버 재시작 시 사라짐) |
| 패키지 관리 | npm workspaces + concurrently (루트에서 `npm run dev` 한 번으로 실행) |
| 참여자 이름 | 입장 시 이름 입력, localStorage에 저장. 색상은 이름 해시로 자동 배정 |
| 언어 목록 | JavaScript(기본), TypeScript, Python, Java, Go, HTML, JSON |
| 새 방 초기 코드 | 주석 한 줄 (예: `// 여기에 코드를 작성하세요`) |
| 배포 | 이번 단계에서는 로컬 실행만 |

---

## 1. 전체 아키텍처

### 1-1. 한눈에 보기

```
 [브라우저 A]                                         [브라우저 B]
 Monaco Editor                                        Monaco Editor
     ↕ (y-monaco: 편집 내용 ↔ Y.Text 변환)                ↕
 Y.Doc ── Y.Text("code")  : 코드 본문                  Y.Doc (같은 구조)
       ── Y.Map("settings"): 언어 등 공유 설정
 Awareness : 이름·색상·커서·선택 영역 (저장되지 않는 임시 상태)
     ↕ HocuspocusProvider                                ↕ HocuspocusProvider
     └────────────── WebSocket (ws://localhost:1234) ──────────────┘
                              ↕
                  [Hocuspocus 서버 (Node.js)]
                  문서 이름 = 방 ID, 방마다 Y.Doc을 메모리에 보관
                  변경분을 받아 같은 방의 다른 참여자에게 전달
```

### 1-2. 데이터 흐름 (A가 타이핑할 때)

1. A가 Monaco에 글자를 입력한다.
2. y-monaco가 그 변경을 Y.Text에 반영한다.
3. Y.Doc이 "무엇이 바뀌었는지"만 담은 작은 업데이트를 만든다.
4. HocuspocusProvider가 업데이트를 WebSocket으로 서버에 보낸다.
5. 서버가 같은 방(문서 이름이 같은)에 접속한 다른 사람에게 업데이트를 전달한다.
6. B의 Provider가 Y.Doc에 적용하고, y-monaco가 B의 Monaco 화면을 갱신한다.

동시에 둘이 편집해도 Yjs(CRDT)가 순서와 상관없이 같은 결과로 합쳐 주므로, 별도의 충돌 해결 코드는 필요 없다.

### 1-3. 각 기술이 왜 필요한가

| 기술 | 왜 필요한가 |
|---|---|
| **Monaco Editor** | VS Code와 같은 편집기. 문법 강조, 자동 들여쓰기, 언어별 모드를 기본 제공한다. |
| **Yjs (Y.Doc)** | 여러 사람이 동시에 고쳐도 충돌 없이 합쳐 주는 CRDT 라이브러리. 공유할 데이터(코드, 설정)를 담는 그릇이다. |
| **Y.Text** | Yjs의 공유 문자열 타입. 코드 본문을 담는다. |
| **Y.Map** | Yjs의 공유 키-값 타입. 언어 같은 방 설정을 담는다. |
| **y-monaco** | Monaco ↔ Y.Text를 연결하는 어댑터. 원격 커서·선택 영역 표시도 담당한다. |
| **Awareness** | "지금 누가 접속해 있고 어디에 커서가 있는가" 같은 임시 상태를 공유하는 Yjs 기능. 문서에 저장되지 않고, 접속이 끊기면 사라진다. |
| **Hocuspocus Server** | Yjs 업데이트를 방 단위로 중계하는 WebSocket 서버. 이후 저장·로그인을 붙이기 좋은 훅(hook) 구조를 가진다. |
| **HocuspocusProvider** | 클라이언트 쪽에서 서버와 WebSocket 연결·재연결을 관리하고 접속 상태 이벤트를 준다. |
| **React Router** | `/` 와 `/room/:roomId` 두 화면을 URL로 구분한다. 링크 공유의 기반이다. |
| **nanoid** | 짧고 추측하기 어려운 방 ID를 만든다. 별도 DB 없이 ID만으로 방이 성립한다. |

---

## 2. 폴더 및 파일 구조

```
Thinc Link/
├── package.json              # workspaces(client, server) + concurrently 스크립트
├── PLAN.md
├── client/
│   ├── package.json
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── src/
│       ├── main.tsx               # React 진입점, BrowserRouter
│       ├── App.tsx                # 라우트 정의 ( / , /room/:roomId )
│       ├── pages/
│       │   ├── Home.tsx           # "방 만들기" 버튼 → nanoid → /room/:id 이동
│       │   └── Room.tsx           # 방 화면 조립 (이름 확인 → 상단 바 + 편집기)
│       ├── components/
│       │   ├── NameDialog.tsx         # 이름이 없을 때 입력받는 화면
│       │   ├── Editor.tsx             # Monaco + y-monaco 바인딩
│       │   ├── PresenceBar.tsx        # 상단 접속자 목록
│       │   ├── LanguageSelect.tsx     # 언어 선택 (Y.Map과 양방향 연동)
│       │   ├── CopyLinkButton.tsx     # 현재 URL 복사
│       │   └── ConnectionStatus.tsx   # 연결됨 / 연결 중 / 끊김 표시
│       ├── hooks/
│       │   └── useCollabRoom.ts       # Y.Doc·Provider 생성/정리, 상태·접속자·언어 노출
│       ├── lib/
│       │   ├── user.ts                # 이름 저장/조회(localStorage), 이름→색상 해시
│       │   └── languages.ts           # 지원 언어 목록 상수
│       └── styles/
│           ├── app.css                # 전체 레이아웃
│           └── remote-cursor.css      # 원격 커서/선택 영역 스타일 (직접 작성)
└── server/
    ├── package.json
    ├── tsconfig.json
    └── src/
        └── index.ts               # Hocuspocus 서버 (포트 1234)
```

### 파일별 핵심 역할

- **`useCollabRoom.ts`**: 데모의 중심. 방 ID를 받아 `Y.Doc`과 `HocuspocusProvider`를 만들고, 컴포넌트가 사라질 때 정리한다. `doc`, `provider`, `status`, `users`, `language`, `setLanguage`를 돌려준다. 생성/정리 로직이 한 곳에 모여 있어 StrictMode 문제도 여기서만 다루면 된다.
- **`Editor.tsx`**: Monaco가 마운트되면 `MonacoBinding(ytext, model, new Set([editor]), provider.awareness)`을 만들고, 언마운트 때 `binding.destroy()`를 호출한다.
- **`remote-cursor.css` + 동적 스타일**: y-monaco는 원격 커서에 `yRemoteSelection`, `yRemoteSelectionHead` 클래스(+ clientID가 붙은 클래스)만 붙여 주고 모양은 제공하지 않는다. 기본 모양은 CSS 파일에, 사용자별 색상·이름 라벨은 접속자 목록이 바뀔 때 `<style>` 태그를 갱신해 적용한다.
- **`server/src/index.ts`**: `Server.configure({ port: 1234 })` 정도의 최소 서버. 데모에서는 저장 확장 없이 메모리에만 보관한다.

---

## 3. 설치할 패키지

### 3-1. 패키지 목록

| 위치 | 패키지 |
|---|---|
| 루트 (dev) | `concurrently` |
| client | `react`, `react-dom`, `react-router-dom`, `nanoid`, `@monaco-editor/react`, `monaco-editor`, `yjs`, `y-monaco`, `@hocuspocus/provider` |
| client (dev) | `vite`, `@vitejs/plugin-react`, `typescript`, `@types/react`, `@types/react-dom` |
| server | `@hocuspocus/server` |
| server (dev) | `tsx`, `typescript`, `@types/node` |

> `yjs`는 client와 server 양쪽에서 쓰이므로 버전이 어긋나지 않게 주의한다. `yjs`가 두 번 로드되면 "Yjs was already imported" 경고가 나온다. (6장 참고)

### 3-2. 설치 명령 (예정)

```bash
# 0. 루트에서 워크스페이스 초기화
npm init -y
# 루트 package.json 에 "workspaces": ["client", "server"] 추가

# 1. 클라이언트 생성 (Vite React-TS 템플릿)
npm create vite@latest client -- --template react-ts

# 2. 클라이언트 의존성
npm install -w client react-router-dom nanoid @monaco-editor/react monaco-editor yjs y-monaco @hocuspocus/provider

# 3. 서버 생성 및 의존성
mkdir server && cd server && npm init -y && cd ..
npm install -w server @hocuspocus/server yjs
npm install -w server -D tsx typescript @types/node

# 4. 루트 개발 도구
npm install -D concurrently
```

---

## 4. 구현 순서 체크리스트

각 단계는 작게 나누었고, 끝날 때마다 "완료 확인 방법"으로 직접 확인한 뒤 다음으로 넘어간다.

- [ ] **단계 0. 프로젝트 뼈대**
  - 루트 workspaces 설정, `client/`(Vite) 생성, `server/` 생성, 루트 `dev` 스크립트(concurrently) 추가
  - 완료 확인: `npm run dev` 실행 시 Vite 기본 화면이 `http://localhost:5173`에 뜬다.

- [ ] **단계 1. Hocuspocus 서버 기동**
  - `server/src/index.ts`에 포트 1234 서버 작성, 연결/해제 로그 출력
  - 완료 확인: 서버 콘솔에 "listening" 계열 로그가 나온다. (연결 로그는 단계 4에서 확인)

- [ ] **단계 2. 라우팅과 방 만들기**
  - `Home`(버튼) → `nanoid(10)` 생성 → `navigate('/room/' + id)`, `Room`은 우선 방 ID만 표시
  - 완료 확인: 버튼을 누르면 URL이 `/room/xxxxxxxxxx`로 바뀌고, 그 URL을 새 탭에 붙여 넣어도 같은 방 ID가 보인다.

- [ ] **단계 3. Monaco 에디터 표시**
  - `Editor.tsx`에 `@monaco-editor/react` 배치, 기본 언어 JavaScript, 높이는 화면 가득
  - 완료 확인: 방 화면에서 문법 강조가 되는 편집기에 타이핑할 수 있다. (이 시점엔 아직 공유되지 않는다.)

- [ ] **단계 4. Yjs 연결과 공동 편집 (핵심)**
  - `useCollabRoom`에서 `Y.Doc` + `HocuspocusProvider({ url, name: roomId, document })` 생성, 정리 함수 작성
  - `Editor`의 `onMount`에서 `MonacoBinding` 생성, 언마운트 시 `destroy`
  - 완료 확인: 브라우저 창 두 개로 같은 방 URL을 열고, 한쪽에서 입력한 글이 다른 쪽에 즉시 나타난다. 양쪽에서 동시에 입력해도 글이 섞이거나 사라지지 않는다. 한쪽을 새로고침해도 내용이 유지된다. (두 창이 모두 닫히면 서버 메모리에서 사라질 수 있음)

- [ ] **단계 5. 이름 입력과 Awareness 등록**
  - `lib/user.ts`: localStorage 이름 읽기/쓰기, 이름 → 색상 해시
  - `NameDialog`: 이름이 없으면 입력받고 방에 들어가도록 `Room`에서 분기
  - Provider 생성 후 `awareness.setLocalStateField('user', { name, color })`
  - 완료 확인: 새로고침해도 이름을 다시 묻지 않는다. 개발자 도구에서 `provider.awareness.getStates()`(또는 임시 로그)에 자신의 이름·색상이 보인다.

- [ ] **단계 6. 원격 커서와 선택 영역 표시**
  - `remote-cursor.css` 작성, 접속자별 색상 동적 스타일 주입, 이름 라벨(커서 위 말풍선)
  - 완료 확인: 두 창에서 한쪽이 커서를 옮기거나 글을 드래그해 선택하면 다른 창에 해당 사용자의 색상으로 커서 막대, 선택 영역, 이름 라벨이 보인다.

- [ ] **단계 7. 접속자 목록**
  - `PresenceBar`: awareness `change` 이벤트로 접속자 배열 갱신, 색상 점 + 이름 표시, 본인은 "(나)" 표기
  - 완료 확인: 창을 하나 더 열면 목록에 사람이 늘고, 창을 닫으면 몇 초 안에 사라진다. 같은 사람이 탭을 두 개 열었을 때 중복 표시 방침(탭마다 표시 vs 이름 기준 합치기)을 정해 일관되게 동작한다.

- [ ] **단계 8. 언어 선택 공유**
  - `languages.ts` 상수, `LanguageSelect`, `Y.Map("settings")`의 `language` 키를 읽고 쓰기, `monaco.editor.setModelLanguage` 호출
  - 완료 확인: 한 창에서 Python으로 바꾸면 다른 창의 문법 강조도 즉시 바뀐다. 나중에 입장한 창도 현재 언어로 시작한다.

- [ ] **단계 9. 방 링크 복사 버튼**
  - `navigator.clipboard.writeText(window.location.href)`, 성공 시 "복사됨!" 문구를 잠깐 표시
  - 완료 확인: 버튼 클릭 후 다른 곳에 붙여 넣으면 방 URL이 나오고, 그 URL로 접속하면 같은 방에 들어간다.

- [ ] **단계 10. 접속 상태 표시**
  - Provider의 `status` 이벤트를 구독해 연결됨(녹색) / 연결 중 / 끊김(빨강) 표시
  - 완료 확인: 서버를 껐다 켜면 표시가 "끊김 → 연결 중 → 연결됨"으로 바뀌고, 다시 연결된 뒤 편집이 이어서 공유된다.

- [ ] **단계 11. 정리와 통합 점검**
  - React StrictMode를 켠 상태에서 provider 중복 생성, 콘솔 경고/에러 확인
  - 방 → 홈 → 다른 방으로 이동하며 이전 방의 연결이 남지 않는지 확인
  - 완료 확인: 아래 "최종 통합 시나리오"를 통과한다.

### 최종 통합 시나리오

1. 창 A에서 "방 만들기" → 이름 입력 → 링크 복사
2. 창 B(시크릿 창이면 이름을 다시 묻는지도 확인)에 링크를 붙여 입장
3. A, B가 동시에 타이핑, 서로의 커서·선택·이름 라벨이 보임
4. 상단 접속자 목록에 두 명이 표시됨
5. A가 언어를 Python으로 변경하면 B도 변경됨
6. 서버 재시작 시 "끊김" 표시 후 자동 재연결됨
7. B를 닫으면 A의 접속자 목록에서 B가 사라짐

---

## 5. 로컬 실행 방법

```bash
# 최초 1회: 루트에서 전체 설치
npm install

# 서버 + 클라이언트 동시 실행 (루트 dev 스크립트: concurrently)
npm run dev

# 또는 각각 따로 실행 (터미널 두 개)
npm run dev -w server    # Hocuspocus 서버 → ws://localhost:1234
npm run dev -w client    # Vite 개발 서버 → http://localhost:5173
```

- 클라이언트의 서버 주소는 환경변수로 뺀다: `client/.env`의 `VITE_COLLAB_URL=ws://localhost:1234` (기본값도 코드에 둔다)
- 같은 컴퓨터에서 테스트: 일반 창 + 시크릿 창으로 접속하면 다른 사용자처럼 확인할 수 있다 (localStorage가 분리됨)
- 다른 기기에서 테스트: Vite를 `--host`로 띄우고, `VITE_COLLAB_URL`을 개발 PC의 IP로 지정

---

## 6. 예상되는 어려운 점과 해결 방법

### 6-1. 원격 커서가 보이지 않는다
- **원인**: y-monaco는 클래스 이름만 붙이고 스타일은 제공하지 않는다. 또는 awareness에 `user`가 등록되지 않았거나, `MonacoBinding`에 `provider.awareness`를 넘기지 않았다.
- **해결**:
  - `new MonacoBinding(ytext, model, new Set([editor]), provider.awareness)` 네 번째 인자 확인
  - `.yRemoteSelection`(선택 영역 배경), `.yRemoteSelectionHead`(커서 막대)에 기본 스타일 작성
  - 사용자별 색상은 clientID가 붙은 클래스(`.yRemoteSelection-<clientID>`, `.yRemoteSelectionHead-<clientID>`)에 대해 접속자 변경 시 `<style>`을 갱신해 적용
  - 이름 라벨은 `.yRemoteSelectionHead-<clientID>::after { content: "이름"; }` 방식
  - 개발자 도구 Elements에서 에디터 안에 해당 클래스가 실제로 생기는지 먼저 확인

### 6-2. React StrictMode에서 provider가 두 번 만들어진다
- **원인**: 개발 모드의 StrictMode는 effect를 "마운트 → 정리 → 재마운트"로 두 번 실행한다. 렌더 중에 provider를 만들면 연결이 중복된다.
- **해결**:
  - Doc/Provider 생성은 렌더 본문이 아니라 `useEffect` 안에서 하고, 반드시 정리 함수에서 `provider.destroy()`와 `doc.destroy()`를 호출한다.
  - 생성한 객체는 `useState`로 보관해 effect 이후 렌더에서 사용한다. (정리 후 재생성되므로 StrictMode에서도 마지막 하나만 살아남는다.)
  - 확인: 서버 로그에서 방 입장 시 연결이 한 번만 유지되는지, 접속자 목록에 "나"가 두 번 나오지 않는지 본다.

### 6-3. 컴포넌트가 사라질 때 provider/binding 정리
- **정리 순서**: `binding.destroy()` → `provider.destroy()` → `doc.destroy()` (사용하는 쪽부터 먼저 끊는다).
- 방 이동 시 `roomId`가 effect 의존성에 있어야 이전 방 연결이 닫히고 새 방 연결이 만들어진다.
- 이름 변경 등으로 effect가 다시 돌아 연결을 새로 만들지 않도록, 이름은 awareness 갱신으로만 처리한다.

### 6-4. Monaco 인스턴스 불일치 (y-monaco가 동작하지 않거나 워커 에러)
- `@monaco-editor/react`는 기본적으로 CDN에서 Monaco를 불러오고, y-monaco는 번들된 `monaco-editor`를 import한다. 둘이 다르면 커서/선택 데코레이션이 어긋날 수 있다.
- **해결**: `loader.config({ monaco })`로 로컬 `monaco-editor`를 쓰도록 통일하고, Vite 환경의 Monaco 워커 설정(`?worker` import)을 추가한다. 문제가 생기면 이 항목부터 점검한다.

### 6-5. 연결 직후 편집기가 비어 보이거나 내용이 두 번 들어간다
- 초기 동기화 전에 초기 코드를 직접 넣으면 접속할 때마다 중복된다.
- **해결**: 초기 코드는 Y.Text가 비어 있을 때 **첫 동기화 완료(`synced`) 후 한 번만** 삽입한다. 또는 초기 코드를 아예 넣지 않고 Monaco의 placeholder로 안내한다.

### 6-6. 언어 선택이 루프를 돌거나 늦게 들어온 사람에게 반영되지 않음
- Y.Map `observe` 이벤트에서만 `setModelLanguage`를 호출하고, 셀렉트 변경 시에는 Y.Map에만 쓴다. 이렇게 단방향으로 흐르게 하면 루프가 없다.
- 늦게 입장한 사람은 동기화 후 Y.Map의 현재 값을 읽어 초기 적용한다. 값이 없으면 JavaScript 기본값.

### 6-7. 접속자 목록에 나간 사람이 늦게 사라지거나 중복 표시
- 탭을 강제 종료하면 awareness 타임아웃(약 30초)이 지나야 사라질 수 있다. 정상 종료는 즉시 사라진다.
- 같은 사람이 탭을 두 개 열면 clientID가 두 개이므로 두 번 보인다. 데모에서는 허용하거나 이름 기준으로 합친다. 어느 쪽이든 단계 7에서 하나를 정해 둔다.

### 6-8. `yjs` 중복 로드 경고
- `Yjs was already imported` 경고는 서로 다른 `yjs` 사본이 설치됐다는 뜻이다. workspaces에서 같은 버전으로 호이스팅되도록 하고, 필요하면 `npm ls yjs`로 확인한다.

### 6-9. 서버 재시작/전원 종료 시 내용이 사라진다
- DB가 없는 데모의 정상 동작이다. 화면과 문서에 "데모에서는 서버를 재시작하면 코드가 사라집니다"를 명시해 오해를 막는다. (저장은 7장 확장 계획)

### 6-10. 기타
- 클립보드 API는 `localhost` 또는 HTTPS에서만 동작한다. 로컬 IP로 접속해 테스트할 때 복사가 실패하면 `document.execCommand('copy')` 대체 경로를 고려한다.
- 방 ID는 짧아도 추측이 어려운 10자 이상을 쓴다. (인증이 없으므로 링크를 아는 사람은 누구나 입장한다.)

---

## 7. 확장 계획 (이번 데모 범위 밖)

> 아래 항목은 구현 단계에 포함하지 않는다. 나중에 어디에 붙일지만 정리한다.

| 확장 기능 | 붙일 위치 / 고려할 점 |
|---|---|
| **문서 저장 (DB)** | 서버에 Hocuspocus의 `Database` 확장(`@hocuspocus/extension-database`) 또는 `onStoreDocument`/`onLoadDocument` 훅 추가. 문서 이름(방 ID)을 키로 Y.Doc 바이너리를 SQLite/PostgreSQL에 저장. 클라이언트 코드는 거의 바뀌지 않는다. |
| **로그인 / 방 권한** | 서버 `onAuthenticate` 훅에서 토큰 검증, 클라이언트는 `HocuspocusProvider({ token })`로 전달. 현재 `lib/user.ts`의 임시 이름을 계정 정보로 교체. 방 목록·방 소유자 정보는 REST API + DB를 별도로 추가. |
| **음성/화상 통화** | 코드 동기화(WebSocket)와 분리된 미디어 경로 필요. WebRTC SFU 서비스(LiveKit 등)를 쓰는 편이 현실적이며, `Room.tsx` 상단 바 옆에 `components/call/` 패널로 추가. 방 ID를 통화방 이름으로 그대로 재사용. |
| **AI 회의 요약** | 통화 음성 전사본 + Y.Doc 변경 이력을 서버에서 모아 요약 API 호출. 서버에 별도 서비스/라우트로 추가하고 결과를 Y.Map 또는 DB에 저장. |
| **칸반 연동** | 같은 Y.Doc에 `Y.Array`/`Y.Map` 타입(예: `kanban`)을 추가하거나 외부 칸반 API와 연동. 화면은 `Room` 안에 탭/사이드 패널로 추가. |
| **타임머신 (과거 시점 되돌리기)** | 저장 확장과 함께 주기적 스냅샷 보관(`Y.snapshot`) 또는 업데이트 로그 저장. 방 화면에 타임라인 슬라이더 추가. DB 도입이 선행되어야 한다. |
| **페어 프로그래밍 모드** | Awareness에 역할(`driver`/`navigator`) 필드를 추가하고, 네비게이터는 읽기 전용으로 전환(서버 `readOnly` 연결 옵션 또는 Monaco `readOnly`). 커서 따라가기는 awareness의 커서 위치로 구현. |
| **코드-문서 딥링크** | 문서/코드 위치를 `/room/:id?file=...&line=...` 형태 URL이나 Y.RelativePosition으로 표현. 현재 단일 파일 구조를 다중 파일 구조(`Y.Map` 파일 목록)로 확장해야 한다. |
| **브라우저 라이브 콘솔** | 코드 실행은 반드시 격리된 샌드박스 iframe 또는 Web Worker에서 수행(보안). 실행 결과를 Y.Array로 공유하면 모두가 같은 콘솔을 본다. `Room.tsx` 하단에 콘솔 패널 추가. Python 등 다른 언어는 별도 실행 서버나 WASM(Pyodide) 필요. |
| **배포** | 서버는 상시 WebSocket을 지원하는 호스팅, 클라이언트는 정적 호스팅. HTTPS 환경에서는 `wss://` 사용, 환경변수 `VITE_COLLAB_URL`만 교체하면 된다. |

### 확장을 쉽게 하기 위해 데모에서 지켜 둘 점

- Yjs 연결/정리 로직은 `useCollabRoom` 한 곳에만 둔다. (로그인/저장 추가 시 이 훅과 서버만 수정)
- 방 ID = 문서 이름 규칙을 유지한다. (저장, 통화방, 딥링크의 공통 키가 된다.)
- 공유 데이터는 타입별로 Y.Doc 안에 이름을 붙여 둔다. (`code`, `settings`, 이후 `kanban`, `console`)
- 서버 주소는 환경변수로 분리한다.
