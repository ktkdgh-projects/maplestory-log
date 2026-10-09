import type { NuxtApp } from '#app'

// 다시 들어온 페이지는 지난번 값을 바로 보여주고, 화면이 뜬 뒤 뒤에서 새로 받는다
export function useRevisitCache() {
  let hit = false
  return {
    getCachedData(key: string, nuxtApp: NuxtApp, ctx: { cause: string }) {
      if (nuxtApp.isHydrating) return nuxtApp.payload.data[key]
      if (ctx.cause !== 'initial') return undefined
      const cached = nuxtApp.payload.data[key]
      if (cached !== undefined && cached !== null) hit = true
      return cached ?? undefined
    },
    revalidate(...refreshes: (() => Promise<unknown>)[]) {
      onMounted(() => {
        if (hit) refreshes.forEach(refresh => refresh())
      })
    },
  }
}
