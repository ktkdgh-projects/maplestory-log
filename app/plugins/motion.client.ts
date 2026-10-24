// 장식 움직임은 그 페이지를 처음 볼 때만 둔다(다시 들어온 페이지까지 움직이면 그동안 화면을 계속 다시 그린다). fresh는 데이터가 늦게 와서 늦게 나온 장식도 끝까지 움직일 만큼 둔다
const FRESH_MS = 6000

export default defineNuxtPlugin(() => {
  const root = document.documentElement
  const router = useRouter()
  const seen = new Set<string>()
  let timer: ReturnType<typeof setTimeout> | undefined
  const mark = (path: string) => {
    if (seen.has(path)) return
    seen.add(path)
    root.classList.add('fresh')
    clearTimeout(timer)
    timer = setTimeout(() => root.classList.remove('fresh'), FRESH_MS)
  }
  mark(router.currentRoute.value.path)
  router.afterEach(to => mark(to.path))
})
