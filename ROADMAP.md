# 실시간 코딩 회의방 데모 — 실행 로드맵

> 목표: 빈 폴더에서 시작해, **브라우저 두 개로 같은 방에 들어가 코드를 동시에 편집**하는 데모를 만든다.
> 구조와 확장 계획은 `PLAN.md`, 단계별 실행 순서는 이 문서(`ROADMAP.md`)를 기준으로 한다.

## 기술 스택 (이대로 사용)

| 영역 | 사용 기술 |
|---|---|
| 프론트엔드 | Vite + React + TypeScript |
| 코드 편집기 | Monaco Editor (`@monaco-editor/react`) |
| 실시간 동기화 | Yjs + y-monaco |
| 동기화 서버 | Hocuspocus (`@hocuspocus/server`, `@hocuspocus/provider`) |
| 라우팅 / 방 ID | React Router + nanoid |
| 데이터베이스 | 없음 (방 ID = Yjs 문서 이름) |

폴더: `client/`(프론트엔드), `server/`(Hocuspocus 서버, 포트 **1234**)

## 진행 규칙

- 패키지는 **최신 안정 버전**으로 설치하고, **설치된 버전에 맞는 API**를 사용한다. 특히 Hocuspocus는 버전에 따라 서버 생성 방식(`new Hocuspocus()` + 직접 연결 / `Server.configure()` 등)이 다르므로, 설치 후 버전을 확인하고 작성한다.
- 설명과 코드 주석은 **한국어**로 쓴다. 변수명·함수명은 영어.
- 실시간 협업이 처음이므로, 각 단계에서 **핵심 코드가 무슨 역할인지 짧게 설명**한다.
- 디자인은 모던하고 깔끔하게: **어두운 테마**, 편집기가 화면 대부분을 차지하도록 한다.
- 오류가 나면 **임의로 다른 라이브러리로 바꾸지 않는다.** 원인과 해결 방법을 먼저 설명한 뒤 진행한다.
- **데모 범위 밖 기능은 만들지 않는다**: 로그인, DB 저장, 음성 통화, 코드 실행.

---

## 1단계: 서버

- [ ] `server/`에 Node + TypeScript 프로젝트 생성 후 Hocuspocus 설치, 설치 버전 확인
- [ ] 포트 1234로 Hocuspocus 서버 작성
- [ ] 클라이언트 접속/해제 시 **방 이름(documentName)** 과 함께 콘솔 로그 출력
- [ ] `npm run dev`(또는 `start`) 스크립트 추가

**핵심 코드 역할**
- Hocuspocus 서버는 같은 이름의 문서(= 방)에 접속한 사람들끼리 변경분을 중계한다. 서버 코드는 거의 없고, 접속/해제 훅(hook)에서 로그만 찍는다.

**완료 확인**
- `npm run dev` 실행 시 서버가 포트 1234에서 정상 실행되고 시작 로그가 보인다. (접속/해제 로그는 3단계에서 확인)

---

## 2단계: 클라이언트 기본 + 방 만들기

- [ ] Vite + React + TypeScript로 `client/` 생성, React Router, nanoid, `@monaco-editor/react` 설치
- [ ] `/` 홈 화면: **"방 만들기"** 버튼 → `nanoid(8)`로 ID 생성 → `/room/:roomId`로 이동
- [ ] 홈 화면에 **방 ID 입력창**을 두어 기존 방에 입장 (빈 값 방지)
- [ ] `/room/:roomId` 화면: 방 ID 표시 + Monaco 편집기 (아직 동기화 없음)
- [ ] 어두운 테마 기본 레이아웃 (편집기가 화면 대부분 차지)

**핵심 코드 역할**
- `nanoid`: 짧고 추측하기 어려운 방 ID 생성. DB 없이 ID만으로 방이 성립한다.
- React Router의 `useParams`: URL에서 `roomId`를 읽는다. 이 값이 이후 Yjs 문서 이름이 된다.

**완료 확인**
- 방 만들기를 누르면 `/room/xxxxxxxx`로 이동하고 편집기가 보인다.
- 방 ID를 입력해 입장해도 같은 화면으로 이동한다.

---

## 3단계: 실시간 공동 편집

- [ ] `Y.Doc` + `HocuspocusProvider(name = roomId)` + `MonacoBinding` 연결
- [ ] 방을 나가거나 컴포넌트가 사라질 때 **binding → provider → ydoc** 순서로 `destroy()` 정리
- [ ] React **StrictMode에서 provider가 두 번 생성되지 않도록** 처리 (`useEffect` 안에서 생성하고 cleanup에서 정리)

**핵심 코드 역할**
- `Y.Doc`: 공유 데이터 그릇. 그 안의 `Y.Text("code")`가 코드 본문이다.
- `HocuspocusProvider`: WebSocket으로 서버에 연결해 변경분을 주고받고, 재연결을 관리한다. `name`이 방 ID다.
- `MonacoBinding`: Monaco 편집기와 `Y.Text`를 양방향으로 이어 준다. 동시에 편집해도 Yjs(CRDT)가 충돌 없이 합친다.

**완료 확인**
- 같은 방 주소를 브라우저 창 두 개로 열어, 한쪽에서 친 내용이 다른 쪽에 **바로** 보인다.
- **다른 방 주소끼리는 내용이 섞이지 않는다.**
- 서버 콘솔에 방 이름과 함께 접속/해제 로그가 찍히고, StrictMode에서도 연결이 중복되지 않는다.

---

## 4단계: 참여자 표시

- [ ] 접속 시 **랜덤 닉네임과 색상**을 만들어 awareness에 등록 (닉네임은 수정 가능, 수정 시 awareness 갱신)
- [ ] 화면 상단에 **접속자 목록**을 색상 점 + 이름으로 표시 (본인은 "(나)" 표기)
- [ ] 다른 참여자의 **커서와 선택 영역**을 그 사람의 색상으로 표시, 커서 위에 **이름 라벨** 표시
- [ ] y-monaco가 붙이는 원격 커서 CSS 클래스(`yRemoteSelection`, `yRemoteSelectionHead` 및 clientID가 붙은 클래스)에 맞춰 **스타일 직접 작성**

**핵심 코드 역할**
- Awareness: "누가 접속 중이고 커서가 어디인가" 같은 **임시 상태**를 공유하는 Yjs 기능. 문서에 저장되지 않고 접속이 끊기면 사라진다.
- `awareness.setLocalStateField('user', { name, color })`로 내 정보를 등록하고, `change` 이벤트로 접속자 목록을 갱신한다.
- y-monaco는 클래스 이름만 붙이고 모양은 제공하지 않으므로, 색상·라벨 CSS는 직접 작성해야 한다.

**완료 확인**
- 두 창에서 서로의 이름이 목록에 보이고, 서로의 커서·선택 영역·이름 라벨이 각자의 색상으로 보인다.
- 창을 닫으면 목록에서 사라진다.

---

## 5단계: 편의 기능

- [ ] **언어 선택 드롭다운** (JavaScript, TypeScript, Python, HTML, CSS)을 `Y.Map`에 저장해 모든 참여자에게 공유
- [ ] **방 링크 복사** 버튼 + 복사 완료 알림 표시
- [ ] **서버 연결 상태** 표시 (연결됨 / 연결 중 / 끊김)

**핵심 코드 역할**
- `Y.Map("settings")`의 `language` 키: 셀렉트를 바꾸면 Y.Map에만 쓰고, Y.Map 변경 이벤트(`observe`)에서 Monaco 언어를 바꾼다. 한 방향으로만 흐르게 해서 루프를 막고, 나중에 입장한 사람도 현재 언어로 시작한다.
- Provider의 `status` 이벤트: 연결 상태를 알려 준다. 이를 화면 표시와 연결한다.
- `navigator.clipboard.writeText`: 링크 복사. `localhost`/HTTPS에서만 동작한다.

**완료 확인**
- 한쪽에서 언어를 바꾸면 다른 쪽 편집기의 문법 강조도 바뀐다.
- 복사 버튼을 누르면 알림이 뜨고, 붙여 넣은 주소로 같은 방에 들어간다.
- 서버를 끄면 "끊김"으로 바뀌고, 다시 켜면 "연결됨"으로 돌아와 편집이 이어진다.

---

## 6단계: 마무리

- [ ] 프로젝트 루트에 `README.md` 작성: 설치 방법, 서버/클라이언트 실행 명령, 동작 확인 방법
- [ ] 루트에서 서버와 클라이언트를 **한 번에 실행**하는 스크립트 추가 (`concurrently` 사용)

**핵심 코드 역할**
- 루트 `package.json`의 `dev` 스크립트가 `concurrently`로 서버와 클라이언트를 동시에 띄운다.

**완료 확인**
- 새로 받은 상태에서 README 순서대로 `npm install` → `npm run dev` 만 해도 서버(1234)와 클라이언트가 함께 실행된다.
- 브라우저 두 개로 최종 시나리오(방 만들기 → 링크 공유 → 동시 편집 → 커서·이름 표시 → 언어 변경 → 서버 끊김 표시)가 통과한다.

---

## 막혔을 때 점검 메모

| 증상 | 점검할 것 |
|---|---|
| 원격 커서가 안 보임 | `MonacoBinding` 4번째 인자에 `provider.awareness` 전달 여부, awareness에 `user` 등록 여부, 에디터 DOM에 `yRemoteSelection` 클래스가 생기는지, CSS 작성 여부 |
| 연결이 두 번 생김 / 접속자에 "나"가 두 명 | provider를 렌더 중에 만들고 있지 않은지, `useEffect` cleanup에서 destroy 하는지 |
| 편집기가 어긋나거나 워커 에러 | `@monaco-editor/react`가 CDN Monaco를, y-monaco가 번들 `monaco-editor`를 써서 달라지는 경우 → `loader.config({ monaco })`로 통일하고 Vite 워커 설정 |
| 접속할 때마다 초기 코드가 중복됨 | 동기화 전에 초기 코드를 넣지 않았는지 (넣으려면 `synced` 이후 비어 있을 때만) |
| `Yjs was already imported` 경고 | `npm ls yjs`로 중복 설치 확인 |
| 서버 재시작 후 코드가 사라짐 | DB가 없는 데모의 정상 동작 |

> 오류가 나도 라이브러리를 바꾸지 말고, 원인과 해결 방법을 먼저 설명한 뒤 진행한다.

## 범위 밖 (만들지 않음)

로그인, DB 저장, 음성/화상 통화, 코드 실행, AI 요약, 칸반, 타임머신 등은 데모에 포함하지 않는다. 확장 시 붙일 위치는 `PLAN.md`의 "확장 계획"을 참고한다.
