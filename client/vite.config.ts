import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// y-monaco 0.1.6은 'monaco-editor/esm/vs/editor/editor.api.js'를 import하는데,
// monaco-editor 0.57의 exports 매핑에서는 이 경로가 풀리지 않는다.
// 같은 파일을 실제 경로로 연결해 주어, y-monaco와 편집기가 같은 monaco 인스턴스를 쓰게 한다.
const monacoEditorApi = fileURLToPath(
  new URL('./node_modules/monaco-editor/esm/vs/editor/editor.api.js', import.meta.url),
)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'monaco-editor/esm/vs/editor/editor.api.js': monacoEditorApi,
    },
  },
})
