// 레다봇 화면: 주소의 파티(p)로 데이터를 받고, 디스코드 로그인이 안 돼 있으면 로그인하러 보낸다
export async function usePartyPage<T>(api: string) {
  const route = useRoute()
  // await 뒤에는 Nuxt 문맥이 끊겨서, 미리 잡아 두고 그 안에서 이동시킨다
  const nuxtApp = useNuxtApp()
  const partyId = String(route.query.p ?? '')
  const { data, error, refresh } = await useFetch<T>(api, { query: { p: partyId } })
  if (error.value?.statusCode === 401) {
    await nuxtApp.runWithContext(() => navigateTo(`/api/discord/login?next=${encodeURIComponent(route.fullPath)}`, { external: true }))
  }
  const openError = computed(() => (error.value?.data as { message?: string } | undefined)?.message ?? '디스코드에서 버튼을 다시 눌러 주세요.')
  return { partyId, data, refresh, openError }
}
