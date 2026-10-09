import type { MeResponse } from '#shared/types'

export async function useMe() {
  const { data, refresh } = await useFetch<MeResponse>('/api/me', {
    key: 'me',
    default: () => ({ user: null }),
    // 페이지를 옮길 때마다 다시 받지 않고, 로그인·로그아웃·키 변경 때 refresh()로만 새로 받는다
    getCachedData: (key, nuxtApp, ctx) => (ctx.cause === 'refresh:manual' || ctx.cause === 'refresh:hook' ? undefined : nuxtApp.payload.data[key]),
  })
  const me = computed(() => data.value.user)
  return { me, refresh }
}
