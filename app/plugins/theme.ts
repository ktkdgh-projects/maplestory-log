// 고른 모드는 서버가 html에 바로 붙이고, 컴퓨터 설정이면 그리기 전에 도는 짧은 스크립트가 시스템 값을 붙인다
export default defineNuxtPlugin(() => {
  const { choice } = useTheme()
  const fixed = choice.value === 'light' || choice.value === 'dark' ? choice.value : undefined
  useHead({
    htmlAttrs: fixed ? { 'data-theme': fixed } : {},
    script: fixed ? [] : [{ key: 'theme', tagPosition: 'head', innerHTML: `document.documentElement.dataset.theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'` }],
  })
  if (import.meta.client) {
    applyTheme(choice.value)
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (choice.value === 'system') applyTheme('system')
    })
  }
})
