import type { CharacterDetail, EquipmentItem } from '#shared/types'

// API는 지금 장착 상태의 전투력만 주므로, 조합별 값은 (주스탯×4+부스탯)·공격력·(데미지+보공)·크뎀 변화 비율로 추정한다

type Stat = 'STR' | 'DEX' | 'INT' | 'LUK'
const STATS: Stat[] = ['STR', 'DEX', 'INT', 'LUK']
const SUB_STAT: Record<Stat, Stat> = { STR: 'DEX', DEX: 'STR', INT: 'LUK', LUK: 'DEX' }
// 제논은 STR·DEX·LUK이 모두 주스탯이고, HP가 주스탯인 데몬어벤져는 이 방식으로 추정할 수 없다
const XENON = '제논'
const UNSUPPORTED_JOBS = ['데몬어벤져']

interface Bundle {
  flat: Record<Stat, number>
  percent: Record<Stat, number>
  attack: number
  magic: number
  attackPercent: number
  magicPercent: number
  damage: number
  critDamage: number
}

function emptyBundle(): Bundle {
  return {
    flat: { STR: 0, DEX: 0, INT: 0, LUK: 0 },
    percent: { STR: 0, DEX: 0, INT: 0, LUK: 0 },
    attack: 0,
    magic: 0,
    attackPercent: 0,
    magicPercent: 0,
    damage: 0,
    critDamage: 0,
  }
}

const LABEL_TO_STAT: Record<string, Stat> = { STR: 'STR', DEX: 'DEX', INT: 'INT', LUK: 'LUK' }

function addLine(bundle: Bundle, line: string, level: number) {
  const perLevel = line.match(/9레벨 당 (STR|DEX|INT|LUK) \+(\d+)/)
  if (perLevel) {
    bundle.flat[LABEL_TO_STAT[perLevel[1]!]!] += Number(perLevel[2]) * Math.floor(level / 9)
    return
  }
  const potential = line.match(/^(.+?) :? ?\+(\d+)(%?)$/)
  const ability = line.match(/^(.+?) (\d+)(%?) 증가$/)
  const [, rawName, rawValue, percent] = potential ?? ability ?? []
  if (!rawName) return
  const name = rawName.trim()
  const value = Number(rawValue)
  const isPercent = percent === '%'

  if (LABEL_TO_STAT[name]) {
    if (isPercent) bundle.percent[LABEL_TO_STAT[name]!] += value
    else bundle.flat[LABEL_TO_STAT[name]!] += value
  }
  else if (name === '올스탯' || name === '모든 능력치') {
    for (const stat of STATS) {
      if (isPercent) bundle.percent[stat] += value
      else bundle.flat[stat] += value
    }
  }
  else if (name === '공격력') {
    if (isPercent) bundle.attackPercent += value
    else bundle.attack += value
  }
  else if (name === '마력') {
    if (isPercent) bundle.magicPercent += value
    else bundle.magic += value
  }
  else if (name === '보스 몬스터 데미지' || name === '데미지' || name === '보스 몬스터 공격 시 데미지') {
    if (isPercent) bundle.damage += value
  }
  else if (name === '크리티컬 데미지' && isPercent) {
    bundle.critDamage += value
  }
}

function addItem(bundle: Bundle, item: EquipmentItem, level: number) {
  for (const option of item.options) {
    if (LABEL_TO_STAT[option.label] && !option.percent) bundle.flat[LABEL_TO_STAT[option.label]!] += option.total
    else if (option.label === '올스탯' && option.percent) STATS.forEach(stat => (bundle.percent[stat] += option.total))
    else if (option.label === '공격력') bundle.attack += option.total
    else if (option.label === '마력') bundle.magic += option.total
    else if (option.label === '보스 몬스터 데미지' || option.label === '데미지') bundle.damage += option.total
  }
  for (const line of [...item.potentials, ...item.additionalPotentials]) addLine(bundle, line, level)
}

function bundleOf(items: EquipmentItem[], abilityLines: string[], level: number): Bundle {
  const bundle = emptyBundle()
  for (const item of items) addItem(bundle, item, level)
  for (const line of abilityLines) addLine(bundle, line, level)
  return bundle
}

interface PresetCombo {
  equipPreset: number
  abilityPreset: number
  value: number
  current: boolean
}

// 장비 프리셋 × 어빌리티 프리셋 조합 중 전투력이 가장 높게 나오는 것. 추정할 수 없는 직업이면 null
export function findBestPresetCombo(character: CharacterDetail): PresetCombo | null {
  const current = character.combatPower
  if (!current || UNSUPPORTED_JOBS.includes(character.job)) return null

  const stat = (name: string) => Number(character.stats.find(s => s.name === name)?.value ?? 0)
  const finalStats = Object.fromEntries(STATS.map(s => [s, stat(s)])) as Record<Stat, number>
  const main = STATS.reduce((best, s) => (finalStats[s] > finalStats[best] ? s : best), 'STR' as Stat)
  const statWeights: Partial<Record<Stat, number>> = character.job === XENON ? { STR: 4, DEX: 4, LUK: 4 } : { [main]: 4, [SUB_STAT[main]]: 1 }
  const magician = stat('마력') > stat('공격력')
  const finalAttack = magician ? stat('마력') : stat('공격력')
  const finalDamage = stat('데미지') + stat('보스 몬스터 데미지')
  const finalCrit = stat('크리티컬 데미지')

  const base = bundleOf(character.presets[character.presetNo - 1] ?? [], (character.abilityPresets[character.abilityPresetNo - 1] ?? []).map(line => line.value), character.level)
  // 지금 값에서 퍼센트를 걷어낸 뒤 조합의 고정 수치 차이를 더하고 그 조합의 퍼센트를 다시 곱한다
  const scaled = (final: number, baseFlat: number, basePercent: number, flat: number, percent: number) =>
    (final / (1 + basePercent / 100) + (flat - baseFlat)) * (1 + percent / 100)

  const combos: PresetCombo[] = []
  character.presets.forEach((items, e) => {
    if (!items.length) return
    character.abilityPresets.forEach((lines, a) => {
      const b = bundleOf(items, lines.map(line => line.value), character.level)
      let statNow = 0
      let statNew = 0
      for (const [s, weight] of Object.entries(statWeights) as [Stat, number][]) {
        statNow += finalStats[s] * weight
        statNew += scaled(finalStats[s], base.flat[s], base.percent[s], b.flat[s], b.percent[s]) * weight
      }
      const attackNew = magician
        ? scaled(finalAttack, base.magic, base.magicPercent, b.magic, b.magicPercent)
        : scaled(finalAttack, base.attack, base.attackPercent, b.attack, b.attackPercent)

      const ratio
        = (statNew / statNow)
        * (attackNew / finalAttack)
        * ((100 + finalDamage + b.damage - base.damage) / (100 + finalDamage))
        * ((100 + finalCrit + b.critDamage - base.critDamage) / (100 + finalCrit))

      combos.push({
        equipPreset: e + 1,
        abilityPreset: a + 1,
        value: Math.round(current * ratio),
        current: e + 1 === character.presetNo && a + 1 === character.abilityPresetNo,
      })
    })
  })
  // 같은 값이면 지금 조합을 골라 굳이 바꾸라고 안내하지 않는다
  return combos.sort((x, y) => y.value - x.value || Number(y.current) - Number(x.current))[0] ?? null
}
