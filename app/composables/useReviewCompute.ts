import type { Ref } from 'vue'
import type { PotentialOptionTable, ReviewPotential, ReviewResponse, ReviewStarforce } from '#shared/types'
import type { StarforcePlan } from '~/utils/starforceCalc'
import type { PotentialReview } from '~/utils/reviewCalc'

export const reviewStarforceKey = (s: ReviewStarforce) => `sf|${s.item}`
export const reviewPotentialKey = (p: ReviewPotential) => `pot|${p.item}|${p.additional}`

// 강화 결산 계산: 스타포스는 장비마다 계산기 Worker로 기대값을, 잠재는 공식 확률표로 평균 횟수를 내고 기간 합을 만든다.
// 결산 페이지와 썬데이 페이지 결산 카드가 같이 쓴다
export function useReviewCompute(data: Readonly<Ref<ReviewResponse | null>>, mvp: Readonly<Ref<number>>, levelPick: Readonly<Ref<Record<string, number>>>) {
  const starforceList = computed(() => [...(data.value?.starforce ?? [])].sort((a, b) => starforceActual(b) - starforceActual(a)))
  const potentialList = computed(() => [...(data.value?.potential ?? [])].sort((a, b) => b.meso - a.meso || b.tools.reduce((n, t) => n + t.count, 0) - a.tools.reduce((n, t) => n + t.count, 0)))
  // 지금 안 낀 장비는 사용자가 레벨을 고르면 계산한다
  const levelOf = (s: ReviewStarforce) => s.level ?? levelPick.value[s.item] ?? null

  const plans = shallowRef<Record<string, StarforcePlan>>({})
  const worker = useStarforceWorker()
  let planSeq = 0
  watch([starforceList, levelPick, mvp], async ([list]) => {
    const seq = ++planSeq
    worker.cancel()
    const next: Record<string, StarforcePlan> = {}
    plans.value = next
    for (const s of list) {
      const level = levelOf(s)
      if (!level || s.to <= s.from) continue
      const plan = await worker.plan(starforceOptions(s, level, mvp.value))
      if (seq !== planSeq) return
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
