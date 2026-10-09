import { LANGUAGES } from '../lib/languages'

interface Props {
  value: string
  onChange: (id: string) => void
}

export default function LanguageSelect({ value, onChange }: Props) {
  return (
    <select
      className="lang-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="언어 선택"
    >
      {LANGUAGES.map((l) => (
        <option key={l.id} value={l.id}>
          {l.label}
        </option>
      ))}
    </select>
  )
}
