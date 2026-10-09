import { useEffect, useState } from 'react'
import Editor from '@monaco-editor/react'
import type { OnMount } from '@monaco-editor/react'
import { MonacoBinding } from 'y-monaco'
import type { CollabRoom } from '../hooks/useCollabRoom'
import '../lib/monaco'

type StandaloneEditor = Parameters<OnMount>[0]

export default function CollabEditor({ ydoc, provider, language }: CollabRoom & { language: string }) {
  const [editor, setEditor] = useState<StandaloneEditor | null>(null)

  // Monaco 편집기가 준비되고 Y.Doc도 있을 때 둘을 연결한다.
  useEffect(() => {
    const model = editor?.getModel()
    if (!editor || !model) return

    // MonacoBinding: 편집기 내용 ↔ Y.Text("code")를 양방향으로 동기화한다.
    const binding = new MonacoBinding(
      ydoc.getText('code'),
      model,
      new Set([editor]),
      provider.awareness, // 4단계의 커서/선택 공유에 사용된다.
    )
    return () => binding.destroy()
  }, [editor, ydoc, provider])

  return (
    <Editor
      height="100%"
      theme="vs-dark"
      language={language} // 공유된 언어가 바뀌면 문법 강조도 바뀐다.
      onMount={(e) => setEditor(e)}
      options={{ fontSize: 14, minimap: { enabled: false }, automaticLayout: true }}
    />
  )
}
