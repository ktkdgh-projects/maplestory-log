import type { Ref } from 'vue'
import type { CharacterBrief, EnhanceResponse, MeResponse } from '#shared/types'

// 모아 두는 기록이 최근 반년이라 6개월은 날짜를 걸지 않고 전부 본다
export const ENHANCE_PERIODS = [
  { label: '6개월', days: null },
  { label: '3개월', days: 90 },
  { label: '1개월', days: 30 },
  { label: '1주', days: 7 },
  { label: '오늘', days: 1 },
] as const

const POLL_MS = 4000

// 스타포스·잠재 기록 페이지가 같이 쓰는 캐릭터·기간 고르기와 넥슨 기록 모으기.
// 안에서 await하면 Nuxt 문맥을 잃어서, 페이지가 받아 둔 로그인 정보를 넘겨받는다
export function useEnhanceRecords(me: Readonly<Ref<MeResponse['user']>>) {
  const characters = ref<CharacterBrief[]>([])
  const ocid = ref<string | null>(me.value?.main?.ocid ?? null)
  const failure = ref('')
  const days = ref<number | null>(null)
  // 날짜를 직접 고르면 기간 버튼보다 앞선다
  const pickedFrom = ref('')
  const from = computed(() => pickedFrom.value || (days.value ? addDays(kstToday(), -(days.value - 1)) : undefined))
  watch(days, () => {
    pickedFrom.value = ''
  })

  onMounted(async () => {
    if (!me.value) return
    characters.value = await $fetch<CharacterBrief[]>('/api/me/characters').catch((error) => {
      failure.value = errorMessage(error)
      return []
    })
    ocid.value ??= characters.value[0]?.ocid ?? null
  })

  // 넥슨 기록을 처음 모을 땐 시간이 걸려 화면을 먼저 띄우고 뒤에서 받는다
  const { data, pending, error, refresh } = useLazyFetch<EnhanceResponse>(() => `/api/enhance/${ocid.value}`, {
    query: computed(() => ({ from: from.value })),
    server: false,
    immediate: false,
    watch: false,
  })
  watch([ocid, from], ([value]) => {
    if (value) refresh()
  }, { immediate: true })

  // 아직 모으는 중이면 이어서 모으도록 몇 초마다 다시 부른다
  let timer: ReturnType<typeof setTimeout> | undefined
  watch(() => data.value?.syncing, (syncing) => {
    clearTimeout(timer)
    if (syncing) timer = setTimeout(refresh, POLL_MS)
  })
  onBeforeUnmount(() => clearTimeout(timer))

  return { characters, ocid, days, pickedFrom, from, data, pending, error, failure }
}
