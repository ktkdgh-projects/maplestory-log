// 화면 모드. 고른 값은 쿠키에 두어 서버가 처음부터 맞는 색으로 그린다(새로고침 때 반대 색이 비치지 않게)
export type ThemeChoice = 'system' | 'light' | 'dark'
const ORDER: ThemeChoice[] = ['system', 'light', 'dark']

export function useTheme() {
  const choice = useCookie<ThemeChoice>('ml_theme', { default: () => 'system', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
  function next() {
    choice.value = ORDER[(ORDER.indexOf(choice.value) + 1) % ORDER.length]!
    applyTheme(choice.value)
  }
  return { choice, next }
}

export function applyTheme(choice: ThemeChoice) {
  if (!import.meta.client) return
  const dark = choice === 'dark' || (choice !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
}
