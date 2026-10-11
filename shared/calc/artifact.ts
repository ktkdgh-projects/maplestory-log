import { ARTIFACT_BOOSTER_MAX_WEEKS, ARTIFACT_BOOSTER_WEEKS, ARTIFACT_BOSS_EXP, ARTIFACT_BOSS_MISSIONS_COUNTED, ARTIFACT_EFFECTS, ARTIFACT_EXP, ARTIFACT_MAX_LEVEL, effectValue, type ArtifactEffect, type ArtifactEffectKey } from '#shared/data/artifact'
import type { JobTraits, TraitLevel } from '#shared/data/jobTraits'
import { statWeightsOf } from './combatPower'

// 데미지 공식은 넥슨이 공개하지 않아 나무위키 정리를 따른다. 화면에는 '추정'으로 적는다
const CRIT_BASE = 1.35
// 크리티컬 리인포스: 120초마다 30초, 전체 크확의 50%만큼 크뎀
const REINFORCE_RATE = 0.5

export interface ArtifactInput {
  job: string
  stat: (name: string) => number
  levels: Partial<Record<ArtifactEffectKey, number>>
  traits: JobTraits
  // 보스 방어율(300% = 3)
  bossDefense: number
  // 장비·어빌리티 % 합(STR·DEX·INT·LUK, 공격력, 마력)
  percents: { stat: Record<string, number>, attack: number, magic: number }
}

export interface ArtifactPick {
  effect: ArtifactEffect
  level: number
  // 보스 데미지가 오르는 비율. 10레벨까지 남은 몫(gain)과 지금 레벨이 주는 몫(worth). 데미지로 못 바꾸는 효과는 null
  gain: number | null
  worth: number | null
  // 리인포스를 켠 극딜 때 10레벨까지 더 오르는 비율
  burst: number | null
  // 0레벨 → 10레벨일 때 오르는 비율. 배치 순서를 정할 때 쓴다
  full: number | null
  tag: string
}

const LEVEL_LABEL: Record<TraitLevel, string> = { high: '높음', mid: '보통', low: '낮음', unknown: '확인 중' }
// 데미지로 못 바꾸는 효과의 순서. 벞지는 엔버 때문에 대부분 직업이 올리고, 재사용은 직업에 따라 그보다 앞선다
const BUFF_RANK: Record<TraitLevel, number> = { high: 3, mid: 2, low: 1, unknown: 1.5 }
const COOLDOWN_RANK: Record<TraitLevel, number> = { high: 3.5, mid: 1.8, low: 0.5, unknown: 1.2 }
// 데미지가 이보다 덜 오르면 사냥·편의 효과 뒤로 보낸다
const SMALL_GAIN = 0.005

export function artifactPicks(input: ArtifactInput): ArtifactPick[] {
  const { stat, traits } = input
  const levelOf = (key: ArtifactEffectKey) => Math.min(input.levels[key] ?? 0, ARTIFACT_MAX_LEVEL)
  const v = (e: ArtifactEffect, level: number) => effectValue(e, level) / (e.unit === '%' ? 100 : 1)
  const damage = 1 + stat('데미지') / 100 + stat('보스 몬스터 데미지') / 100
  const critMult = CRIT_BASE + stat('크리티컬 데미지') / 100
  // API 크확은 100을 넘어도 그대로 온다
  const critRaw = stat('크리티컬 확률') / 100
  const expected = (c: number, mult: number) => 1 - Math.min(c, 1) + Math.min(c, 1) * mult
  const ied = stat('방어율 무시') / 100
  const magician = stat('마력') > stat('공격력')
  const attack = magician ? stat('마력') : stat('공격력')
  const weights = statWeightsOf(input.job, stat)
  const statScore = Object.entries(weights).reduce((n, [s, w]) => n + stat(s) * w!, 0)
  const statPer = Object.entries(weights).reduce((n, [s, w]) => n + w! * (1 + (input.percents.stat[s] ?? 0) / 100), 0)
  const attackPer = 1 + (magician ? input.percents.magic : input.percents.attack) / 100

  // 효과 레벨이 L일 때의 데미지 계수. 지금 스탯에서 지금 레벨 몫을 빼고 L레벨 몫을 넣는다
  function factor(e: ArtifactEffect, L: number): number | null {
    const swap = v(e, L) - v(e, levelOf(e.key))
    switch (e.key) {
      case 'damage':
      case 'boss':
        return damage + swap
      case 'critDmg':
        return expected(critRaw, critMult + swap)
      case 'ied': {
        // 방무는 곱으로 쌓인다
        const without = 1 - (1 - ied) / (1 - v(e, levelOf(e.key)))
        return Math.max(0, 1 - input.bossDefense * (1 - without) * (1 - v(e, L)))
      }
      case 'att':
        return attack ? attack + attackPer * swap : null
      case 'allStat':
        return traits.stat === 'demonAvenger' || !statScore ? null : statScore + statPer * swap
      case 'critRate':
        return expected(critRaw + swap, critMult)
      default:
        return null
    }
  }
  const ratio = (a: number | null, b: number | null) => (a !== null && b ? a / b - 1 : null)

  function tagOf(e: ArtifactEffect): string {
    switch (e.key) {
      case 'cooldown': return `재사용 ${LEVEL_LABEL[traits.cooldown]}`
      case 'buff': return `벞지 ${LEVEL_LABEL[traits.buff]}`
      case 'summon': return traits.summon === 'yes' ? '소환수 직업' : '안 씀'
      case 'finalAttack': return traits.finalAttack === 'yes' ? '파이널 어택 직업' : '안 씀'
      case 'hpMp': return traits.stat === 'demonAvenger' ? 'HP가 주스탯' : '생존'
      case 'status': return '편의'
      default: return ''
    }
  }

  return ARTIFACT_EFFECTS.map((effect) => {
    const level = levelOf(effect.key)
    const now = factor(effect, level)
    const gain = ratio(factor(effect, ARTIFACT_MAX_LEVEL), now)
    const worth = ratio(now, factor(effect, 0))
    // 100%를 넘긴 크확은 리인포스 직업만 극딜 때 크뎀으로 쓴다
    const burst = effect.key === 'critRate' && traits.critOver === 'yes' ? REINFORCE_RATE * (v(effect, ARTIFACT_MAX_LEVEL) - v(effect, level)) / critMult : null
    const full = ratio(factor(effect, ARTIFACT_MAX_LEVEL), factor(effect, 0))
    return { effect, level, gain, worth, burst, full, tag: tagOf(effect) }
  })
}

// 효과를 올릴 순서. 큰 데미지 효과 → 사냥(고르면) → 벞지·재사용 → 쓰는 직업만 소환수·파이널 어택 → 작은 데미지 효과 → HP → 상태이상
export function artifactPriority(picks: ArtifactPick[], traits: JobTraits, hunt: boolean): { order: ArtifactEffectKey[], important: ArtifactEffectKey[] } {
  const rank = (p: ArtifactPick): number => {
    const damage = (p.full ?? 0) + (p.effect.key === 'critRate' && traits.critOver === 'yes' ? (p.burst ?? 0) : 0)
    if (p.effect.group === 'hunt') return hunt ? 90 + ['meso', 'drop', 'exp'].indexOf(p.effect.key) * -0.1 : 1
    switch (p.effect.key) {
      case 'buff': return 80 + BUFF_RANK[traits.buff]
      case 'cooldown': return 80 + COOLDOWN_RANK[traits.cooldown]
      case 'summon': return traits.summon === 'yes' ? 79 : 2
      case 'finalAttack': return traits.finalAttack === 'yes' ? 79 : 2
      case 'hpMp': return traits.stat === 'demonAvenger' ? 95 : 30
      case 'status': return 20
      default: return damage >= SMALL_GAIN ? 100 + damage * 100 : 40 + damage * 100
    }
  }
  // 포인트를 써서 옵션을 바꿀 만한 효과. 나머지(중요도 낮은 재사용·벞지, HP, 상태이상, 안 쓰는 효과)는 빈칸이 생길 때만 넣는다
  const worthSwap = (p: ArtifactPick): boolean => {
    switch (p.effect.key) {
      case 'buff': return traits.buff === 'high' || traits.buff === 'mid'
      case 'cooldown': return traits.cooldown === 'high' || traits.cooldown === 'mid'
      case 'summon': return traits.summon === 'yes'
      case 'finalAttack': return traits.finalAttack === 'yes'
      case 'hpMp': return traits.stat === 'demonAvenger'
      case 'status': return false
      default: return p.effect.group === 'hunt' ? hunt : (p.full ?? 0) + (p.burst ?? 0) >= SMALL_GAIN
    }
  }
  const sorted = [...picks].sort((a, b) => rank(b) - rank(a))
  return { order: sorted.map(p => p.effect.key), important: sorted.filter(worthSwap).map(p => p.effect.key) }
}

interface CrystalSlot { grade: number, options: ArtifactEffectKey[] }

const CRYSTAL_OPTIONS = 3

// 효과마다 10레벨을 넘지 않게 큰 등급부터 넣고, 남는 몫이 등급보다 작으면 가장 작게 넘치는 칸을 쓴다
function planFromScratch(order: ArtifactEffectKey[], grades: number[]): ArtifactEffectKey[][] {
  const plan = grades.map(() => [] as ArtifactEffectKey[])
  for (const key of order) {
    let need = ARTIFACT_MAX_LEVEL
    while (need > 0) {
      const open = grades.map((_, i) => i).filter(i => grades[i]! > 0 && plan[i]!.length < CRYSTAL_OPTIONS && !plan[i]!.includes(key))
      if (!open.length) break
      const fit = open.filter(i => grades[i]! <= need).sort((x, y) => grades[y]! - grades[x]!)
      const i = fit[0] ?? open.sort((x, y) => grades[x]! - grades[y]!)[0]!
      plan[i]!.push(key)
      need -= grades[i]!
    }
  }
  return plan
}

// 같은 등급 크리스탈끼리는 자리를 바꿔도 결과가 같아, 지금 옵션과 많이 겹치는 크리스탈에 둔다
function matchCurrent(target: ArtifactEffectKey[][], crystals: CrystalSlot[]): ArtifactEffectKey[][] {
  const used = new Set<number>()
  const result = crystals.map(() => [] as ArtifactEffectKey[])
  const byOverlap = crystals.map((_, i) => i).sort((x, y) => crystals[y]!.grade - crystals[x]!.grade)
  for (const i of byOverlap) {
    const keep = (row: ArtifactEffectKey[]) => row.filter(k => crystals[i]!.options.includes(k)).length
    const j = target.map((_, j) => j).filter(j => !used.has(j) && crystals[j]!.grade === crystals[i]!.grade).sort((x, y) => keep(target[y]!) - keep(target[x]!))[0] ?? i
    used.add(j)
    result[i] = [...target[j]!]
  }
  return result
}

function better(order: ArtifactEffectKey[], a: ArtifactEffectKey[][], b: ArtifactEffectKey[][], grades: number[]): number {
  const la = levelsOf(a, grades)
  const lb = levelsOf(b, grades)
  for (const k of order) {
    const d = (la[k] ?? 0) - (lb[k] ?? 0)
    if (d) return d
  }
  return 0
}

// 크리스탈마다 3칸, 한 크리스탈에 같은 효과는 한 번, 효과는 10레벨까지. 처음부터 짠 배치가 더 나을 때만 그쪽을 쓴다
export function planCrystals(order: ArtifactEffectKey[], crystals: CrystalSlot[], important: ArtifactEffectKey[] = order): ArtifactEffectKey[][] {
  const kept = keepCurrent(order, crystals, important)
  if (!important.length) return kept
  const grades = crystals.map(c => c.grade)
  const fresh = matchCurrent(planFromScratch(order, grades), crystals)
  return better(important, fresh, kept, grades) > 0 ? fresh : kept
}

function keepCurrent(order: ArtifactEffectKey[], crystals: CrystalSlot[], important: ArtifactEffectKey[]): ArtifactEffectKey[][] {
  const grades = crystals.map(c => c.grade)
  const rank = (k: ArtifactEffectKey) => order.indexOf(k)
  const plan = crystals.map(c => [...new Set(c.options)].slice(0, CRYSTAL_OPTIONS))
  const level = (k: ArtifactEffectKey) => plan.reduce((n, keys, i) => n + (keys.includes(k) ? grades[i]! : 0), 0)

  const total = grades.filter(g => g > 0).length * CRYSTAL_OPTIONS
  const sorted = [...grades].sort((x, y) => y - x)
  let needSlots = 0
  for (let sum = 0; sum < ARTIFACT_MAX_LEVEL && needSlots < sorted.length; needSlots++) sum += sorted[needSlots]!
  const wanted = new Set(important.slice(0, Math.floor(total / Math.max(needSlots, 1))))

  // 1) 10레벨을 넘는 옵션은 등급이 낮은 칸부터 뺀다
  for (const k of order) {
    const holders = plan.map((_, i) => i).filter(i => plan[i]!.includes(k)).sort((x, y) => grades[x]! - grades[y]!)
    for (const i of holders) {
      if (level(k) - grades[i]! >= ARTIFACT_MAX_LEVEL) plan[i] = plan[i]!.filter(x => x !== k)
    }
  }

  // 2) 빈칸은 덜 찬 효과를 순서대로, 10레벨을 안 넘기는 것부터 넣는다
  const fill = () => {
    for (const i of grades.map((_, i) => i).sort((x, y) => grades[y]! - grades[x]!)) {
      while (grades[i]! > 0 && plan[i]!.length < CRYSTAL_OPTIONS) {
        const open = order.filter(k => level(k) < ARTIFACT_MAX_LEVEL && !plan[i]!.includes(k))
        const k = open.find(k => level(k) + grades[i]! <= ARTIFACT_MAX_LEVEL) ?? open[0]
        if (!k) break
        plan[i]!.push(k)
      }
    }
  }
  fill()

  // 3) 덜 찬 중요한 효과(a)를 넣으려고 덜 중요한 옵션(b)을 바꾼다. a가 이미 있는 크리스탈이면 다른 크리스탈과 옵션을 맞바꿔 자리를 만든다
  for (let guard = 0; guard < 30; guard++) {
    const a = order.find(k => wanted.has(k) && level(k) < ARTIFACT_MAX_LEVEL)
    if (!a) break
    let moved = false
    const fits = (i: number) => level(a) + grades[i]! <= ARTIFACT_MAX_LEVEL
    const losers = plan.flatMap((keys, i) => keys.filter(b => !wanted.has(b) && rank(b) > rank(a)).map(b => ({ i, b })))
      .sort((x, y) => Number(fits(y.i)) - Number(fits(x.i)) || rank(y.b) - rank(x.b))
    for (const { i, b } of losers) {
      if (!plan[i]!.includes(a)) {
        plan[i] = plan[i]!.map(x => (x === b ? a : x))
        moved = true
        break
      }
      const j = plan.findIndex((keys, j) => j !== i && grades[j] === grades[i] && !keys.includes(a) && keys.some(x => x !== b && !plan[i]!.includes(x)))
      if (j < 0) continue
      const x = plan[j]!.find(x => x !== b && !plan[i]!.includes(x))!
      plan[j] = plan[j]!.map(y => (y === x ? a : y))
      plan[i] = plan[i]!.map(y => (y === b ? x : y))
      moved = true
      break
    }
    if (!moved) break
  }
  fill()
  return plan
}

export function levelsOf(plan: ArtifactEffectKey[][], grades: number[]): Partial<Record<ArtifactEffectKey, number>> {
  const levels: Partial<Record<ArtifactEffectKey, number>> = {}
  plan.forEach((keys, i) => keys.forEach((k) => {
    levels[k] = Math.min((levels[k] ?? 0) + grades[i]!, ARTIFACT_MAX_LEVEL)
  }))
  return levels
}

interface ArtifactPlanInput {
  level: number
  exp: number
  // 부스터 없이 한 주에 받는 일반·보스 미션 EXP
  normal: number
  boss: number
  boosters: number
}

// 목표 레벨까지 몇 주. 부스터는 일반 미션만 2배, 개당 4주
export function weeksToLevel(p: ArtifactPlanInput, target: number): number | null {
  if (p.level >= target) return 0
  let left = ARTIFACT_EXP[p.level]! - p.exp
  for (let l = p.level + 1; l < target; l++) left += ARTIFACT_EXP[l]!
  const boosted = Math.min(p.boosters * ARTIFACT_BOOSTER_WEEKS, ARTIFACT_BOOSTER_MAX_WEEKS)
  const base = p.normal + p.boss
  if (base <= 0) return null
  let weeks = 0
  while (left > 0) {
    left -= base + (weeks < boosted ? p.normal : 0)
    weeks++
  }
  return weeks
}

export function bossMissionExp(picks: { bossId: string, difficulty: string }[]): { exp: number, counted: string[] } {
  const best = new Map<string, number>()
  for (const p of picks) {
    const exp = ARTIFACT_BOSS_EXP[`${p.bossId}:${p.difficulty}`]
    if (exp && exp > (best.get(p.bossId) ?? 0)) best.set(p.bossId, exp)
  }
  const top = [...best].sort((a, b) => b[1] - a[1]).slice(0, ARTIFACT_BOSS_MISSIONS_COUNTED)
  return { exp: top.reduce((n, [, e]) => n + e, 0), counted: top.map(([id]) => id) }
}
