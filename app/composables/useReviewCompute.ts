import type { Ref } from 'vue'
import type { PotentialOptionTable, ReviewPotential, ReviewResponse, ReviewStarforce } from '#shared/types'
import type { StarforcePlan } from '#shared/calc/starforce'
import { mainTool, methodOfTool, optionTableQuery, reviewPotentialCalc, starforceActual, starforceOptions, type PotentialReview } from '#shared/calc/review'

// 같은 장비도 캐릭터·조건별로 따로 펼치고 계산한다
export const reviewStarforceKey = (s: ReviewStarforce) => `sf|${s.character.ocid}|${s.item}|${s.condition ?? ''}`
export const reviewPotentialKey = (p: ReviewPotential) => `pot|${p.character.ocid}|${p.item}|${p.additional}`
export const reviewLevelKey = (s: ReviewStarforce) => `${s.character.ocid}|${s.item}`

// 결산 페이지와 썬데이 페이지 결산 카드가 같이 쓴다
export function useReviewCompute(data: Readonly<Ref<ReviewResponse | null>>, levelPick: Readonly<Ref<Record<string, number>>>) {
  const starforceList = computed(() => [...(data.value?.starforce ?? [])].sort((a, b) => starforceActual(b) - starforceActual(a)))
  const toolCount = (p: ReviewPotential) => p.tools.reduce((n, t) => n + t.count, 0)
  const potentialList = computed(() => [...(data.value?.potential ?? [])].sort((a, b) => b.meso - a.meso || toolCount(b) - toolCount(a)))
  // 지금 안 낀 장비는 사용자가 레벨을 고르면 계산한다
  const levelOf = (s: ReviewStarforce) => s.level ?? levelPick.value[reviewLevelKey(s)] ?? null

  const plans = shallowRef<Record<string, StarforcePlan>>({})
  const worker = useStarforceWorker()
  let planSeq = 0
  // 조건이 같으면 1만 번 계산을 다시 하지 않는다
  const planCache = new Map<string, StarforcePlan>()
  watch([starforceList, levelPick], async ([list]) => {
    const seq = ++planSeq
    worker.cancel()
    const next: Record<string, StarforcePlan> = {}
    plans.value = next
    for (const s of list) {
      const level = levelOf(s)
      if (!level || s.to <= s.from) continue
      const options = starforceOptions(s, level, s.mvp)
      const cacheKey = JSON.stringify(options)
      const plan = planCache.get(cacheKey) ?? await worker.plan(options)
      if (seq !== planSeq) return
      planCache.set(cacheKey, plan)
      next[reviewStarforceKey(s)] = plan
      plans.value = { ...next }
    }
  }, { deep: true, immediate: true })

  const potReviews = shallowRef<Record<string, PotentialReview | null>>({})
  const potLoading = ref(false)
  watch(potentialList, async (list) => {
    potLoading.value = true
    const next: Record<string, PotentialReview | null> = {}
    await Promise.all(list.map(async (p) => {
      const method = methodOfTool(mainTool(p), p.additional)
      if (!method) {
        next[reviewPotentialKey(p)] = null
        return
      }
      const query = optionTableQuery(p, method)
      const table = query ? await $fetch<PotentialOptionTable>('/api/calc/potential-options', { query }).catch(() => null) : null
      next[reviewPotentialKey(p)] = reviewPotentialCalc(p, method, table)
    }))
    if (list === potentialList.value) {
      potReviews.value = next
      potLoading.value = false
    }
  }, { immediate: true })

  const ready = computed(() => !potLoading.value && starforceList.value.every(s => !levelOf(s) || s.to <= s.from || plans.value[reviewStarforceKey(s)]))
  const totals = computed(() => {
    let sfActual = 0
    let sfExpected = 0
    let sfCount = 0
    for (const s of starforceList.value) {
      const plan = plans.value[reviewStarforceKey(s)]
      if (!plan) continue
      sfActual += starforceActual(s)
      sfExpected += plan.mean.meso
      sfCount++
    }
    let potActual = 0
    let potExpected = 0
    let cubeActual = 0
    let cubeExpected = 0
    for (const p of potentialList.value) {
      const v = potReviews.value[reviewPotentialKey(p)]?.verdict
      if (!v?.expected) continue
      if (v.unit === 'meso') {
        potActual += v.actual
        potExpected += v.expected
      }
      else {
        cubeActual += v.actual
        cubeExpected += v.expected
      }
    }
    return {
      sf: { gain: sfExpected - sfActual, actual: sfActual, expected: sfExpected, count: sfCount },
      pot: { gain: potExpected - potActual, actual: potActual, expected: potExpected },
      cube: { gain: cubeExpected - cubeActual, used: cubeActual > 0 },
      meso: { gain: sfExpected - sfActual + potExpected - potActual, actual: sfActual + potActual, expected: sfExpected + potExpected },
    }
  })

  return { starforceList, potentialList, levelOf, plans, potReviews, potLoading, ready, totals }
}
