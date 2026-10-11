import type { Ref } from 'vue'
import type { CharacterBrief, EnhanceItem, EnhanceResponse, MeResponse } from '#shared/types'

// 모아 두는 기록이 최근 반년이라 6개월은 날짜를 걸지 않고 전부 본다
export const ENHANCE_PERIODS = [
  { label: '6개월', days: null },
  { label: '3개월', days: 90 },
  { label: '1개월', days: 30 },
  { label: '1주', days: 7 },
  { label: '오늘', days: 1 },
] as const
// 서버가 모으는 기간(HISTORY_BACKFILL_DAYS)과 같다
export const ENHANCE_HISTORY_DAYS = 180

const POLL_MS = 4000
const TODAY_CHECK_MS = 60 * 1000

// 페이지를 켜 둔 채 자정이 지나도 '오늘'이 바뀌게 1분마다 확인한다
export function useKstToday() {
  const today = ref(kstToday())
  let timer: ReturnType<typeof setInterval> | undefined
  onMounted(() => {
    timer = setInterval(() => {
      if (today.value !== kstToday()) today.value = kstToday()
    }, TODAY_CHECK_MS)
  })
  onBeforeUnmount(() => clearInterval(timer))
  return today
}

// 안에서 await하면 Nuxt 문맥을 잃어서 페이지가 받아 둔 로그인 정보를 넘겨받는다
export function useEnhanceRecords(me: Readonly<Ref<MeResponse['user']>>, initialOcid: string | null = null) {
  const characters = ref<CharacterBrief[]>([])
  const charactersLoaded = ref(false)
  const ocid = ref<string | null>(initialOcid ?? me.value?.main?.ocid ?? null)
  const failure = ref('')
  const days = ref<number | null>(null)
  const today = useKstToday()
  // 날짜를 직접 고르면 기간 버튼보다 앞선다
  const pickedFrom = ref('')
  const from = computed(() => pickedFrom.value || (days.value ? addDays(today.value, -(days.value - 1)) : undefined))
  watch(days, () => {
    pickedFrom.value = ''
  })

  async function loadCharacters() {
    failure.value = ''
    characters.value = await $fetch<CharacterBrief[]>('/api/me/characters').catch((error) => {
      failure.value = errorMessage(error)
      return []
    })
    charactersLoaded.value = true
    ocid.value ??= characters.value[0]?.ocid ?? null
  }
  onMounted(() => {
    if (me.value) loadCharacters()
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

  // 아직 모으는 중이면 응답이 올 때마다 몇 초 뒤 다시 부른다. 받는 중 실패하면 멈춘다
  let timer: ReturnType<typeof setTimeout> | undefined
  function poll() {
    clearTimeout(timer)
    if (data.value?.syncing && !error.value) timer = setTimeout(() => refresh().finally(poll), POLL_MS)
  }
  watch(data, poll)
  onBeforeUnmount(() => clearTimeout(timer))

  return { characters, charactersLoaded, loadCharacters, ocid, days, pickedFrom, from, today, data, pending, error, failure, refresh }
}

// 같은 이름 장비를 두 개 낄 수 있어(반지 등) 부위까지 붙여 가린다
export const enhanceItemKey = (i: Pick<EnhanceItem, 'slot' | 'name'>) => `${i.slot}:${i.name}`

// 넥슨 기록엔 아이템 고유 번호가 없어 같은 이름 장비는 기록을 함께 쓴다. 합계는 이름마다 한 번만 센다
export const uniqueByName = (items: EnhanceItem[]) => [...new Map(items.map(i => [i.name, i])).values()]

// 넘치면 오래 전에 받은 상세부터 버린다
const DETAIL_CACHE_MAX = 24

// 새로 받는 동안(새 기록·기간 변경)엔 이전 결과를 그대로 둬 화면이 비지 않게 한다
export function useEnhanceDetail<T>(name: string, key: () => string | null, fetcher: () => Promise<T>) {
  const cache = useState(name, () => ({})) as Ref<Record<string, T>>
  const last = shallowRef(null) as Ref<T | null>
  const loading = ref(false)
  const failure = ref('')
  const detail = computed<T | null>(() => {
    const k = key()
    return (k ? cache.value[k] : undefined) ?? last.value
  })
  let seq = 0
  async function load() {
    const k = key()
    if (!k) return
    if (cache.value[k]) {
      last.value = cache.value[k]
      return
    }
    const mine = ++seq
    loading.value = true
    failure.value = ''
    try {
      const result = await fetcher()
      if (mine !== seq) return
      const next = { ...cache.value, [k]: result }
      const keys = Object.keys(next)
      for (const old of keys.slice(0, Math.max(0, keys.length - DETAIL_CACHE_MAX))) delete next[old]
      cache.value = next
      last.value = result
    }
    catch (e) {
      if (mine === seq) failure.value = errorMessage(e)
    }
    finally {
      if (mine === seq) loading.value = false
    }
  }
  watch(key, load, { immediate: true })
  return { detail, loading, failure, retry: load }
}

// 새 기록이 와도 맨 위 날짜가 그대로면 펼친 상태를 지킨다
export function useOpenDays(first: () => string | undefined) {
  const open = ref(new Set<string>())
  watch(first, (date) => {
    open.value = new Set(date ? [date] : [])
  }, { immediate: true })
  function toggle(date: string) {
    const next = new Set(open.value)
    if (!next.delete(date)) next.add(date)
    open.value = next
  }
  return { open, toggle }
}

// 목록과 상세가 위아래로 쌓이는 좁은 화면에선 장비를 누르면 상세로 내려가 보여준다
export function revealDetail() {
  if (!window.matchMedia('(max-width: 900px)').matches) return
  nextTick(() => document.querySelector('.enhance-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}
