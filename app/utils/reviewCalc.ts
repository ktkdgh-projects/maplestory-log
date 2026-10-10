import type { PotentialOptionTable, ReviewPotential, ReviewStarforce } from '#shared/types'
import { POTENTIAL_GRADES, POTENTIAL_PARTS, RESET_METHODS, resetCost, type PotentialGrade, type ResetMethod } from '#shared/data/potential'
import type { StarforceOptions, StarforcePlan } from './starforceCalc'

// 강화 결산에서 한 장비 구간을 기대값과 비교한 결과. actual·expected는 메소(큐브는 개수)
export interface ReviewVerdict {
  actual: number
  expected: number
  // 1만 번(잠재는 확률식) 중 실제보다 적게 든 비율. 낮을수록 운이 좋았다
  rank: number | null
  unit: 'meso' | 'cube'
}

// 지금 끼고 있지 않아 레벨을 모르는 장비에 고르게 하는 착용 레벨
export const LEVELS_FOR_STARFORCE = [130, 140, 150, 160, 200, 250]

// 실제로 쓴 메소: 장비 결산에 그 기간으로 적은 값이 있으면 그것, 없으면 기록으로 센 값
export const starforceActual = (s: ReviewStarforce) => s.manual ?? s.meso + s.restoreMeso

export function starforceOptions(s: ReviewStarforce, level: number, mvp: number): StarforceOptions {
  return {
    level,
    from: s.from,
    to: s.to,
    protect: s.protectStars,
    discount: s.discount,
    sure: s.sundayEffects.includes('sure'),
    lessDestroy: s.sundayEffects.includes('lessDestroy'),
    restoreDiscount: s.sundayEffects.includes('restoreDiscount'),
    mvp,
    pc: false,
    // 노작값은 기록으로 알 수 없어 양쪽 모두 메소만 비교한다
    copyPrice: 0,
  }
}

// 정렬된 분포 지점(0~100%)에서 value가 몇 % 지점인지
export function rankIn(quantiles: number[], value: number): number {
  let i = 0
  while (i < quantiles.length && quantiles[i]! <= value) i++
  return Math.max(0, i - 1) / 100
}

export function starforceVerdict(s: ReviewStarforce, plan: StarforcePlan): ReviewVerdict {
  const actual = starforceActual(s)
  return { actual, expected: plan.mean.meso, rank: rankIn(plan.quantiles, actual), unit: 'meso' }
}

// 넥슨 기록의 도구 이름을 계산기 재설정 방식으로. 확률을 모르는 큐브(메멘토 등)는 null
export function methodOfTool(name: string, additional: boolean): ResetMethod | null {
  const id = name === '메소 재설정' ? (additional ? 'meso-addi' : 'meso')
    : name.includes('레드 큐브') ? 'red'
      : name.includes('블랙 큐브') ? 'black'
        : name.includes('에디셔널 큐브') ? 'addi'
          : null
  return RESET_METHODS.find(m => m.id === id && m.additional === additional) ?? null
}

// 가장 많이 쓴 도구 기준으로 본다
export const mainTool = (p: ReviewPotential) => [...p.tools].sort((a, b) => b.count - a.count)[0]?.name ?? ''

// 천장이 있는 기하분포: 평균 시도 수와 n번 안에 끝날 확률
const ceilingMean = (p: number, ceiling: number) => (1 - (1 - p) ** ceiling) / p
const ceilingCdf = (p: number, ceiling: number, n: number) => (n >= ceiling ? 1 : 1 - (1 - p) ** n)

export interface PotentialReview {
  method: ResetMethod
  tiers: { from: string, to: string, tries: number, mean: number, rank: number, ceiling: number }[]
  // 지금 옵션이 이룬 가장 어려운 목표(같은 효과의 합이 그 이상)가 몇 번째에 떴는지
  option: { label: string, tries: number, mean: number, rank: number, chance: number } | null
  // 지금 옵션 줄마다 등급. 그 등급 첫째 줄에 없는 옵션이면 한 단계 아래(이탈)
  lines: { text: string, grade: string | null }[]
  verdict: ReviewVerdict
}

export function optionTableQuery(p: ReviewPotential, method: ResetMethod) {
  const part = partOfSlot(p.slot ?? '')
  const index = part ? POTENTIAL_PARTS.indexOf(part as typeof POTENTIAL_PARTS[number]) : -1
  const grade = POTENTIAL_GRADES.indexOf(p.toGrade as PotentialGrade)
  if (index < 0 || grade < 0 || !p.level) return null
  return { cube: method.cubeItemId, grade: grade + 1, part: index + 1, level: p.level }
}

// 등급 올리기는 공식 등급 상승 확률·천장으로, 옵션 맞추기는 지금 옵션이 이룬 목표(예: STR 21%↑)가 뜰 확률로 평균 시도 수를 낸다
export function reviewPotentialCalc(p: ReviewPotential, method: ResetMethod, table: PotentialOptionTable | null): PotentialReview {
  const cost = (grade: string) => (method.meso && p.level ? resetCost(method.additional, p.level, grade as PotentialGrade) : 0)
  const tiers = p.tiers.flatMap((t, i) => {
    const g = POTENTIAL_GRADES.indexOf(t.from as PotentialGrade)
    if (g < 0) return []
    const rate = method.tierUp[g]! / 100
    // 기간 첫 단계는 그 전에 쌓인 천장을 빼고 센다
    const ceiling = Math.max(1, method.ceiling[g]! - (i === 0 ? p.stackBefore : 0))
    return [{ from: t.from!, to: t.to, tries: t.tries, mean: ceilingMean(rate, ceiling), rank: ceilingCdf(rate, ceiling, t.tries - 1), ceiling }]
  })
  const achieved = table && p.options.length ? achievedGoal(table, p.options) : null
  const option = achieved && p.optionAt
    ? { label: achieved.goal.label, tries: p.optionAt, mean: 1 / achieved.chance, rank: 1 - (1 - achieved.chance) ** (p.optionAt - 1), chance: achieved.chance }
    : null

  const unit = method.meso ? 'meso' : 'cube'
  // 실제는 그 기간에 돌린 전부(옵션이 뜬 뒤 더 돌린 것까지), 평균은 얻은 결과(등급·옵션)까지만이라 더 돌린 만큼은 손해로 잡힌다
  const actual = unit === 'meso' ? p.manual ?? p.meso : p.tools.reduce((n, t) => n + t.count, 0)
  const expected = unit === 'meso'
    ? tiers.reduce((n, t) => n + t.mean * cost(t.from), 0) + (option?.mean ?? 0) * cost(p.toGrade ?? '')
    : tiers.reduce((n, t) => n + t.mean, 0) + (option?.mean ?? 0)
  // 등급 하나만 올렸거나 옵션만 맞췄으면 그 확률로, 둘 다면 시도 수 비율로 대략 본다
  const ranks = [...tiers.map(t => t.rank), ...(option ? [option.rank] : [])]
  const rank = ranks.length === 1 ? ranks[0]! : ranks.length ? ranks.reduce((a, b) => a + b, 0) / ranks.length : null
  const top = POTENTIAL_GRADES.indexOf(p.toGrade as PotentialGrade)
  const prime = new Set(table?.lines[0]?.map(o => o.text) ?? [])
  const lines = p.options.map((text, i) => ({
    text,
    grade: top < 0 ? null : i === 0 || !table || prime.has(text) ? p.toGrade : POTENTIAL_GRADES[top - 1] ?? p.toGrade,
  }))
  return { method, tiers, option, lines, verdict: { actual, expected, rank, unit } }
}
