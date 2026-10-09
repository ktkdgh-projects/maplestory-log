import type { MeResponse } from '#shared/types'

export async function useMe() {
  const { data, refresh } = await useFetch<MeResponse>('/api/me', {
    key: 'me',
    default: () => ({ user: null }),
  })
  const me = computed(() => data.value.user)
  return { me, refresh }
}
