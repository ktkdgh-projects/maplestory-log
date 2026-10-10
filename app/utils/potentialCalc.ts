import type { PotentialOption, PotentialOptionTable } from '#shared/types'
import { OPTION_LIMITS, POTENTIAL_GRADES, resetCost, type PotentialGrade, type ResetMethod } from '#shared/data/potential'

// 넥슨 장비 칸 이름 → 공식 확률표 장비 분류
const SLOT_TO_PART: Record<string, string> = {
  '무기': '무기', '엠블렘': '엠블렘', '보조무기': '보조무기 (포스실드·소울링 제외)', '모자': '모자', '상의': '상의', '하의': '하의',
  '신발': '신발', '장갑': '장갑', '망토': '망토', '벨트': '벨트', '어깨장식': '어깨장식', '얼굴장식': '얼굴장식', '눈장식': '눈장식',
  '귀고리': '귀고리', '반지1': '반지', '반지2': '반지', '반지3': '반지', '반지4': '반지', '펜던트': '펜던트', '펜던트2': '펜던트', '기계 심장': '기계심장',
}
export const partOfSlot = (slot: string) => SLOT_TO_PART[slot] ?? null

interface ParsedOption extends PotentialOption {
  // 같은 효과끼리 묶는 이름. 수치에 단위가 있으면 붙인다 (예: 'STR %', '모든 스킬의 재사용 대기시간 (초)')
  key: string
  value: number
  limit: number | null
}

const OPTION_PATTERN = /^(.*?)\s*[+-]\s*(\d+(?:\.\d+)?)\s*(%|초)?$/

function parseOption(option: PotentialOption): ParsedOption {
  const limit = OPTION_LIMITS.findIndex(l => l.pattern.test(option.text))
  const m = option.text.match(OPTION_PATTERN)
  const key = m ? `${m[1]}${m[3] === '%' ? ' %' : m[3] === '초' ? ' (초)' : ''}` : option.text
  return { ...option, key, value: m ? Number(m[2]) : 0, limit: limit < 0 ? null : limit }
}

// 같은 종류 개수 제한에 걸린 옵션을 빼고 남은 확률로 다시 나눈 그 줄의 후보
function allowedOptions(line: ParsedOption[], picked: ParsedOption[]) {
  return line.filter(o => o.limit === null || picked.filter(p => p.limit === o.limit).length < OPTION_LIMITS[o.limit]!.max)
}

export interface OptionGoal {
  label: string
  // 이 키들의 수치를 더해 threshold 이상이면 성공. 줄 수로 볼 땐 lines
  keys: string[]
  mode: 'sum' | 'lines'
  threshold: number
}

// 한 번 돌렸을 때 목표가 나올 확률(0~1)
export function optionChance(table: PotentialOptionTable, goal: OptionGoal): number {
  const lines = table.lines.map(line => line.map(parseOption))
  const keys = new Set(goal.keys)
  const score = (o: ParsedOption) => (keys.has(o.key) ? (goal.mode === 'sum' ? o.value : 1) : 0)

  function walk(index: number, picked: ParsedOption[], total: number): number {
    if (index === lines.length) return total >= goal.threshold ? 1 : 0
    const allowed = allowedOptions(lines[index]!, picked)
    const sum = allowed.reduce((n, o) => n + o.prob, 0)
    if (!sum) return 0
    // 점수에 영향 없는 옵션은 개수 제한만 신경 쓰면 되므로 묶어서 한 번에 센다
    let chance = 0
    let restProb = 0
    for (const o of allowed) {
      if (score(o) || o.limit !== null) chance += (o.prob / sum) * walk(index + 1, [...picked, o], total + score(o))
      else restProb += o.prob
    }
    if (restProb) chance += (restProb / sum) * walk(index + 1, picked, total)
    return chance
  }
  return walk(0, [], 0)
}

// 직접 고른 옵션 조합이 한 번에 뜰 확률. ordered면 고른 줄에 그대로 떠야 하고, 아니면 어느 줄에 떠도 된다
export function comboChance(table: PotentialOptionTable, picks: (string | null)[], ordered: boolean): number {
  const wanted = picks.filter((p): p is string => !!p)
  const want = new Set(wanted)
  const lines = table.lines.map(line => line.map(parseOption))
  const success = (shown: (string | null)[]) => {
    if (ordered) return picks.every((p, i) => !p || shown[i] === p)
    const left = [...shown]
    return wanted.every((w) => {
      const at = left.indexOf(w)
      if (at < 0) return false
      left.splice(at, 1)
      return true
    })
  }

  function walk(index: number, picked: ParsedOption[], shown: (string | null)[]): number {
    if (index === lines.length) return success(shown) ? 1 : 0
    const allowed = allowedOptions(lines[index]!, picked)
    const sum = allowed.reduce((n, o) => n + o.prob, 0)
    if (!sum) return 0
    // 고르지 않았고 개수 제한도 없는 옵션은 '그 밖'으로 묶어 한 번에 센다
    let chance = 0
    let restProb = 0
    for (const o of allowed) {
      if (want.has(o.text) || o.limit !== null) chance += (o.prob / sum) * walk(index + 1, [...picked, o], [...shown, want.has(o.text) ? o.text : null])
      else restProb += o.prob
    }
    if (restProb) chance += (restProb / sum) * walk(index + 1, picked, [...shown, null])
    return chance
  }
  return walk(0, [], [])
}

// 직접 조합에서 고를 수 있는 옵션. 줄 순서대로면 그 줄에 뜨는 것만, 아니면 어느 줄이든 뜨는 것 전부
export function comboOptions(table: PotentialOptionTable, line: number | null): string[] {
  const source = line === null ? table.lines.flat() : table.lines[line] ?? []
  return [...new Set(source.map(o => o.text))]
}

// 자주 노리는 목표. 표에 있는 옵션만 골라 칩을 만든다. 공식 표의 옵션 글자 그대로 키를 맞춘다
const SUM_GOALS: { name: (stat: string) => string, keys: (stat: string) => string[] }[] = [
  { name: stat => stat, keys: stat => [`${stat} %`, '올스탯 %'] },
  { name: () => '공격력', keys: () => ['공격력 %'] },
  { name: () => '마력', keys: () => ['마력 %'] },
  { name: () => '보공', keys: () => ['보스 몬스터 데미지 %'] },
  { name: () => '크뎀', keys: () => ['크리티컬 데미지 %'] },
  { name: () => '쿨감', keys: () => ['스킬 재사용 대기시간 (초)'] },
  { name: () => '메획', keys: () => ['메소 획득량 %'] },
  { name: () => '아획', keys: () => ['아이템 드롭률 %'] },
]
// 무기류는 공(마)%와 보공을 섞어 유효 줄 수로 본다
const LINE_GOALS = [
  { name: '공·보공', keys: ['공격력 %', '보스 몬스터 데미지 %'] },
  { name: '마·보공', keys: ['마력 %', '보스 몬스터 데미지 %'] },
]

export function goalPresets(table: PotentialOptionTable, stat: string): OptionGoal[] {
  const lines = table.lines.map(line => line.map(parseOption))
  const has = (key: string) => lines.some(line => line.some(o => o.key === key))
  const goals: OptionGoal[] = []
  for (const group of SUM_GOALS) {
    const keys = group.keys(stat)
    // 줄마다 가장 잘 뜨는 수치(올스탯 제외). 두 줄·세 줄 맞춘 합을 목표로 보여준다 (예: STR 12+9=21%, 12+9+9=30%)
    const common = lines.map((line) => {
      const best = line.filter(o => o.key === keys[0]).sort((a, b) => b.prob - a.prob)[0]
      return best?.value ?? 0
    })
    if (!common[0]) continue
    const unit = keys[0]!.endsWith('(초)') ? '초' : '%'
    const two = Math.round((common[0] + (common[1] || common[0])) * 10) / 10
    const three = Math.round((two + (common[2] || common[1] || common[0])) * 10) / 10
    for (const threshold of [two, three]) goals.push({ label: `${group.name(stat)} ${threshold}${unit}↑`, keys, mode: 'sum', threshold })
  }
  for (const group of LINE_GOALS) {
    if (!group.keys.every(has)) continue
    for (const threshold of [2, 3]) goals.push({ label: `${group.name} ${threshold}줄`, keys: group.keys, mode: 'lines', threshold })
  }
  return goals
}

// 이미 뜬 옵션이 이룬 목표 중 가장 어려운 것("STR 21%↑", "공·보공 2줄"). 쓸모없는 줄까지 똑같이 뜰 확률이 아니라
// 같은 효과의 합이 그만큼 이상 뜰 확률로 운을 보려고 쓴다. 이룬 목표가 없으면 null
export function achievedGoal(table: PotentialOptionTable, options: string[]): { goal: OptionGoal, chance: number } | null {
  const shown = options.map(text => parseOption({ text, prob: 0 }))
  const sum = (keys: string[]) => Math.round(shown.filter(o => keys.includes(o.key)).reduce((n, o) => n + o.value, 0) * 10) / 10
  const lines = (keys: string[]) => shown.filter(o => keys.includes(o.key)).length
  const goals: OptionGoal[] = []
  for (const stat of ['STR', 'DEX', 'INT', 'LUK', '최대 HP']) {
    for (const group of SUM_GOALS) {
      const keys = group.keys(stat)
      const value = sum(keys)
      if (value > 0) goals.push({ label: `${group.name(stat)} ${value}${keys[0]!.endsWith('(초)') ? '초' : '%'}↑`, keys, mode: 'sum', threshold: value })
    }
  }
  for (const group of LINE_GOALS) {
    const count = lines(group.keys)
    if (count >= 2) goals.push({ label: `${group.name} ${count}줄`, keys: group.keys, mode: 'lines', threshold: count })
  }
  const unique = [...new Map(goals.map(g => [g.label, g])).values()]
  // HP는 노리는 경우가 드물어(데몬어벤져 정도) 다른 목표가 없을 때만 본다
  const hp = (g: OptionGoal) => g.keys.includes('최대 HP %')
  const candidates = unique.some(g => !hp(g)) ? unique.filter(g => !hp(g)) : unique
  const scored = candidates.map(goal => ({ goal, chance: optionChance(table, goal) })).filter(g => g.chance > 0)
  return scored.length ? scored.reduce((a, b) => (b.chance < a.chance ? b : a)) : null
}

export interface PotentialPlan {
  tierTries: number
  optionTries: number
  chance: number | null
  mean: { tries: number, meso: number | null }
  p50: { tries: number, meso: number | null }
  p90: { tries: number, meso: number | null }
  // 천장 기준 등급 올리기 최대 횟수
  worstTier: number
  costPerTry: number | null
}

const SIMULATIONS = 20_000

// 지금 등급에서 목표 등급까지(천장 반영), 그다음 목표 옵션까지. 등급이 오르는 그 한 번도 목표 등급 옵션이 뜨므로 옵션 시도 1번으로 센다
export function planPotential(method: ResetMethod, level: number, from: number, to: number, stack: number, chance: number | null): PotentialPlan {
  const stages = []
  for (let g = from; g < to; g++) {
    const ceiling = Math.max(1, method.ceiling[g]! - (g === from ? stack : 0))
    const cost = method.meso ? resetCost(method.additional, level, POTENTIAL_GRADES[g] as PotentialGrade) : null
    stages.push({ p: method.tierUp[g]! / 100, ceiling, cost })
  }
  const finalCost = method.meso ? resetCost(method.additional, level, POTENTIAL_GRADES[to] as PotentialGrade) : null

  const random = seededRandom()
  const tries: number[] = []
  const meso: number[] = []
  let tierSum = 0
  let optionSum = 0
  for (let i = 0; i < SIMULATIONS; i++) {
    let t = 0
    let m = 0
    for (const s of stages) {
      const n = Math.min(s.ceiling, Math.ceil(Math.log(1 - random()) / Math.log(1 - s.p)) || 1)
      t += n
      m += n * (s.cost ?? 0)
    }
    tierSum += t
    if (chance !== null) {
      // 등급이 오른 그 한 번에서 이미 뜰 수 있으므로, 처음부터 목표 등급이면 1번째부터 센다
      const n = chance >= 1 ? 1 : Math.ceil(Math.log(1 - random()) / Math.log(1 - chance)) || 1
      const extra = stages.length ? n - 1 : n
      t += extra
      m += extra * (finalCost ?? 0)
      optionSum += extra
    }
    tries.push(t)
    meso.push(m)
  }
  tries.sort((a, b) => a - b)
  meso.sort((a, b) => a - b)
  const at = (list: number[], q: number) => list[Math.min(list.length - 1, Math.floor(list.length * q))]!
  const hasCost = method.meso
  return {
    tierTries: tierSum / SIMULATIONS,
    optionTries: optionSum / SIMULATIONS,
    chance,
    mean: { tries: tries.reduce((a, b) => a + b, 0) / SIMULATIONS, meso: hasCost ? meso.reduce((a, b) => a + b, 0) / SIMULATIONS : null },
    p50: { tries: at(tries, 0.5), meso: hasCost ? at(meso, 0.5) : null },
    p90: { tries: at(tries, 0.9), meso: hasCost ? at(meso, 0.9) : null },
    worstTier: stages.reduce((n, s) => n + s.ceiling, 0),
    costPerTry: finalCost,
  }
}
