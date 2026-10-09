export interface LocalUser {
  name: string
  color: string
}

const STORAGE_KEY = 'collab-user'
export const MAX_NAME_LENGTH = 16

const ADJECTIVES = ['용감한', '느긋한', '반짝이는', '수줍은', '날쌘', '졸린', '빛나는', '엉뚱한']
const ANIMALS = ['고양이', '여우', '다람쥐', '펭귄', '수달', '부엉이', '판다', '고래']

const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)]

// 눈에 잘 띄는 색을 만들기 위해 채도·밝기는 고정하고 색상(hue)만 무작위로 정한다.
function randomColor() {
  return `hsl(${Math.floor(Math.random() * 360)} 75% 60%)`
}

// 이름의 앞뒤 공백·제어문자를 지우고 길이를 제한한다. (CSS 라벨에도 쓰이므로 정리해 둔다)
export function sanitizeName(name: string) {
  // eslint-disable-next-line no-control-regex
  return name.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, MAX_NAME_LENGTH)
}

export function saveUser(user: LocalUser) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
  } catch {
    // 저장소를 쓸 수 없어도 동작에는 문제가 없다.
  }
}

// 저장된 사용자 정보를 읽고, 없으면 랜덤 닉네임·색상을 만들어 저장한다.
export function getLocalUser(): LocalUser {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    if (saved && typeof saved.name === 'string' && typeof saved.color === 'string') {
      const name = sanitizeName(saved.name)
      if (name) return { name, color: saved.color }
    }
  } catch {
    // 저장값이 깨졌으면 새로 만든다.
  }
  const user = { name: `${pick(ADJECTIVES)} ${pick(ANIMALS)}`, color: randomColor() }
  saveUser(user)
  return user
}
