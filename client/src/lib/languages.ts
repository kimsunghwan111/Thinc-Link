export const LANGUAGES = [
  { id: 'javascript', label: 'JavaScript' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'python', label: 'Python' },
  { id: 'html', label: 'HTML' },
  { id: 'css', label: 'CSS' },
] as const

export const DEFAULT_LANGUAGE = 'javascript'

export const isSupportedLanguage = (id: unknown): id is string =>
  LANGUAGES.some((l) => l.id === id)

// 코드 실행을 지원하는 언어. (브라우저에서 실행: JavaScript는 Web Worker, Python은 Pyodide)
export const RUNNABLE_LANGUAGES = ['javascript', 'python'] as const
export type RunnableLanguage = (typeof RUNNABLE_LANGUAGES)[number]

export const isRunnable = (id: string): id is RunnableLanguage =>
  (RUNNABLE_LANGUAGES as readonly string[]).includes(id)

export const languageLabel = (id: string) => LANGUAGES.find((l) => l.id === id)?.label ?? id
