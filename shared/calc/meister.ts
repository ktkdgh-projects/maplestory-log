import { MEISTER_DAILY_FATIGUE, MEISTER_MATERIALS, MEISTER_POTION_DAILY_LIMIT, MEISTER_POTION_FATIGUE, MEISTER_STAGES, type MeisterMaterialKey, type MeisterStage } from '#shared/data/meister'

export interface MeisterProgress {
  // 지금 단계(0 화살 · 1 신발 · 2 숫돌 · 3 명장)와 그 단계에서 만든 개수
  stage: number
  made: number
  have: MeisterMaterialKey[]
  // 하루에 마시는 피로회복제 개수
  potions: number
}

export const MEISTER_START: MeisterProgress = { stage: 0, made: 0, have: [], potions: 0 }

export const dailyFatigue = (p: MeisterProgress) => MEISTER_DAILY_FATIGUE + p.potions * MEISTER_POTION_FATIGUE

export const stageTotal = (stage: MeisterStage) => stage.crafts.reduce((n, c) => n + c.count, 0)

export function normalizeMeister(value: Partial<MeisterProgress> | null | undefined): MeisterProgress {
  const stage = Math.min(Math.max(Math.trunc(Number(value?.stage) || 0), 0), MEISTER_STAGES.length)
  const max = MEISTER_STAGES[stage] ? stageTotal(MEISTER_STAGES[stage]) : 0
  return {
    stage,
    made: Math.min(Math.max(Math.trunc(Number(value?.made) || 0), 0), max),
    have: MEISTER_MATERIALS.map(m => m.key).filter(k => Array.isArray(value?.have) && value.have.includes(k)),
    potions: Math.min(Math.max(Math.trunc(Number(value?.potions) || 0), 0), MEISTER_POTION_DAILY_LIMIT),
  }
}

// 지금부터 남은 제작. 단계 안에서는 위에 적힌 순서대로 만든다고 본다
export function remainingCrafts(p: MeisterProgress) {
  return MEISTER_STAGES.flatMap((stage, s) => {
    if (s < p.stage) return []
    let skip = s === p.stage ? p.made : 0
    return stage.crafts.flatMap((craft) => {
      const done = Math.min(skip, craft.count)
      skip -= done
      const left = craft.count - done
      return left ? [{ stage: s, craft, left, fatigue: left * stage.fatigue }] : []
    })
  })
}

export function remainingMaterials(p: MeisterProgress) {
  const need = new Map<MeisterMaterialKey, number>()
  for (const { craft, left } of remainingCrafts(p)) {
    for (const m of craft.materials) need.set(m.key, (need.get(m.key) ?? 0) + m.each * left)
  }
  return need
}

export interface MeisterDay { parts: { stage: number, count: number }[], fatigue: number }

// 하루 피로도를 단계 순서대로 채운다
export function planMeisterDays(p: MeisterProgress): MeisterDay[] {
  const cap = dailyFatigue(p)
  const days: MeisterDay[] = []
  let day: MeisterDay = { parts: [], fatigue: 0 }
  for (const { stage, left } of remainingCrafts(p)) {
    const per = MEISTER_STAGES[stage]!.fatigue
    let rest = left
    while (rest) {
      if (cap - day.fatigue < per) {
        days.push(day)
        day = { parts: [], fatigue: 0 }
      }
      const count = Math.min(rest, Math.floor((cap - day.fatigue) / per))
      const last = day.parts.at(-1)
      if (last?.stage === stage) last.count += count
      else day.parts.push({ stage, count })
      day.fatigue += count * per
      rest -= count
    }
  }
  if (day.parts.length) days.push(day)
  return days
}

// 오늘(첫날) 피로도로 만들 것. 단계 안에서 위에 적힌 순서대로
export function todayCrafts(p: MeisterProgress) {
  let budget = dailyFatigue(p)
  const list: { stage: number, craft: MeisterStage['crafts'][number], count: number }[] = []
  for (const { stage, craft, left } of remainingCrafts(p)) {
    const per = MEISTER_STAGES[stage]!.fatigue
    const count = Math.min(left, Math.floor(budget / per))
    if (!count) break
    list.push({ stage, craft, count })
    budget -= count * per
  }
  return list
}
