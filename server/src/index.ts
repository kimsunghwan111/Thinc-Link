import { fileURLToPath } from "node:url";
import { Server } from "@hocuspocus/server";
import { SQLite } from "@hocuspocus/extension-sqlite";

const PORT = 1234;

// 저장 파일 위치: 실행 위치와 상관없이 항상 server/rooms.sqlite
const DB_PATH = fileURLToPath(new URL("../rooms.sqlite", import.meta.url));

// Hocuspocus 서버: 같은 documentName(= 방 ID)으로 접속한 클라이언트끼리
// Yjs 변경분을 중계한다.
const server = new Server({
  port: PORT,

  // SQLite 확장: 방(문서)마다 Y.Doc 전체 상태를 파일에 저장하고,
  // 서버가 다시 켜진 뒤 방에 들어오면 저장된 내용을 불러온다.
  // 코드(Y.Text)와 언어 설정(Y.Map)이 같은 문서에 있으므로 함께 저장된다.
  // 변경 후 잠깐(기본 2초) 모아서 저장하고, 서버 종료 신호(Ctrl+C 등)를 받으면
  // 아직 저장되지 않은 내용도 저장한 뒤 종료한다.
  extensions: [new SQLite({ database: DB_PATH })],

  // 클라이언트가 방에 연결을 시작할 때 호출된다.
  async onConnect({ documentName, socketId }) {
    console.log(`[접속] 방: ${documentName} (연결: ${socketId})`);
  },

  // 클라이언트 연결이 끊길 때 호출된다. clientsCount는 해당 방에 남은 접속 수다.
  async onDisconnect({ documentName, socketId, clientsCount }) {
    console.log(
      `[해제] 방: ${documentName} (연결: ${socketId}, 남은 접속자: ${clientsCount})`,
    );
  },
});

await server.listen();
console.log(`Hocuspocus 서버 실행 중: ws://localhost:${PORT}`);
console.log(`방 저장 파일: ${DB_PATH}`);
