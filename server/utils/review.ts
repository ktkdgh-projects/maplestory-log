import type { ObjectId } from 'mongodb'
import type { EquipmentItem, PotentialTier, ReviewPotential, ReviewStarforce } from '#shared/types'
import { PROTECT_STARS } from '#shared/data/starforce'
import type { EnhanceEventDoc } from './mongo'

// 날짜 칩에 점을 찍고 가장 가까운 기록 날을 찾을 만큼만 본다
const RECORD_DAYS_BACK = 60

interface Range { from: string, to: string }
const rangeFilter = (range: Range) => ({ at: { $gte: kstDayStart(range.from), $lt: kstDayStart(addDays(range.to, 1)) } })

// 장비 결산에서 이 캐릭터·장비에 이 기간 날짜로 직접 적은 강화 비용
async function manualCosts(userId: ObjectId, character: string, range: Range) {
  const { itemSheets, itemRows } = await useCollections()
  const sheets = await itemSheets.find({ userId, characterName: character }, { projection: { _id: 1 } }).toArray()
  if (!sheets.length) return { starforce: new Map<string, number>(), potential: new Map<string, number>() }
  const rows = await itemRows.find({ userId, sheetId: { $in: sheets.map(s => s._id) } }).toArray()
  const inRange = (date: string | null | undefined) => !!date && date >= range.from && date <= range.to
  const starforce = new Map<string, number>()
  const potential = new Map<string, number>()
  const add = (map: Map<string, number>, name: string, amount: number) => map.set(name, (map.get(name) ?? 0) + amount)
  for (const r of rows) {
    for (const [map, entries, total, date] of [[starforce, r.starforceEntries, r.starforce, r.starforceDate], [potential, r.potentialEntries, r.potential, r.potentialDate]] as const) {
      if (entries?.length) {
        for (const e of entries) if (inRange(e.date)) add(map, r.name, e.amount)
      }
      else if (total && inRange(date)) add(map, r.name, total)
    }
  }
  return { starforce, potential }
}

// 그 기간에 걸친 썬데이에 운영자가 고른 스타포스 효과
async function sundayEffectsIn(range: Range) {
  const { sundays } = await useCollections()
  const docs = await sundays.find({ start: { $lt: kstDayStart(addDays(range.to, 1)) }, end: { $gte: kstDayStart(range.from) } }, { projection: { start: 1, end: 1, effects: 1 } }).toArray()
  return (at: Date) => docs.find(s => at >= s.start && at <= s.end)?.effects ?? []
}

export async function recordDays(userId: ObjectId, character: string, today: string): Promise<string[]> {
  const { enhanceEvents } = await useCollections()
  const days = await enhanceEvents.aggregate<{ _id: string }>([
    { $match: { userId, character, at: { $gte: kstDayStart(addDays(today, -RECORD_DAYS_BACK)) } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$at', timezone: 'Asia/Seoul' } } } },
    { $sort: { _id: -1 } },
  ]).toArray()
  return days.map(d => d._id)
}

// 고른 기간의 스타포스 기록을 장비별로 묶는다. 비용은 강화 기록 페이지와 같은 계산(MVP 할인·복구 메소 포함)
export async function reviewStarforce(userId: ObjectId, character: string, range: Range, equipped: EquipmentItem[], mvp: number): Promise<ReviewStarforce[]> {
  const { enhanceEvents } = await useCollections()
  const match = { character, ...rangeFilter(range) }
  const docs = await enhanceEvents.find({ userId, kind: 'starforce', ...match }).sort({ at: 1 }).toArray()
  if (!docs.length) return []
  const gear = new Map(equipped.map(i => [i.name, i]))
  const levelOf = (item: string) => gear.get(item)?.requiredLevel || null
  const [restores, effectsAt, manual] = await Promise.all([
    restoresOf(userId, match, levelOf),
    sundayEffectsIn(range),
    manualCosts(userId, character, range),
  ])
  const restoreOf = new Map(restores.map(r => [r.eventId, r.restore]))

  return [...Map.groupBy(docs.filter(d => d.beforeStar !== null && !d.scroll), d => d.item)].map(([item, list]) => {
    const level = levelOf(item)
    const stages = new Map<number, ReviewStarforce['stages'][number]>()
    const path: ReviewStarforce['path'] = []
    const protectStars = new Set<number>()
    let meso = 0
    let restoreMeso = 0
    let copies = 0
    let tries = 0
    for (const d of list) {
      const star = d.beforeStar!
      const stage = stages.get(star) ?? stages.set(star, { star, attempts: 0, success: 0, destroy: 0 }).get(star)!
      stage.attempts++
      tries++
      meso += eventMeso(d, level, mvp) ?? 0
      if (d.protect && PROTECT_STARS.includes(star)) protectStars.add(star)
      const restore = restoreOf.get(d.eventId) ?? null
      if (restore) {
        restoreMeso += restore.fee
        copies += restore.copies
      }
      if (d.success) {
        stage.success++
        path.push({ star, tries, result: 'up', restore: null })
        tries = 0
      }
      else if (d.destroyed) {
        stage.destroy++
        path.push({ star, tries, result: 'destroy', restore })
        tries = 0
      }
    }
    const lastDoc = list.at(-1)!
    if (tries) path.push({ star: lastDoc.beforeStar!, tries, result: 'stop', restore: null })
    const g = gear.get(item)
    return {
      item,
      slot: g?.slot ?? null,
      icon: g?.icon ?? null,
      level,
      from: list[0]!.beforeStar!,
      to: lastDoc.afterStar ?? lastDoc.beforeStar!,
      attempts: list.length,
      destroys: list.filter(d => d.destroyed).length,
      meso,
      restoreMeso,
      copies,
      protectStars: [...protectStars].sort((a, b) => a - b),
      discount: list.some(d => (d.eventDiscount ?? 0) > 0),
      sundayEffects: effectsAt(list[0]!.at),
      stages: [...stages.values()].sort((a, b) => a.star - b.star),
      path,
      first: list[0]!.at.toISOString(),
      last: lastDoc.at.toISOString(),
      manual: manual.starforce.get(item) ?? null,
    }
  })
}

// 고른 기간의 큐브·메소 재설정 기록을 장비·윗잠/에디별로 묶는다
export async function reviewPotential(userId: ObjectId, character: string, range: Range, equipped: EquipmentItem[]): Promise<ReviewPotential[]> {
  const { enhanceEvents } = await useCollections()
  const docs = await enhanceEvents.find({ userId, character, kind: { $in: ['cube', 'potential'] }, ...rangeFilter(range) }).sort({ at: 1 }).toArray()
  if (!docs.length) return []
  const gear = new Map(equipped.map(i => [i.name, i]))
  const manual = await manualCosts(userId, character, range)

  const groups = [...Map.groupBy(docs, d => `${d.item}\n${isAdditional(d.tool)}`).values()]
  return Promise.all(groups.map(async (list) => {
    const first = list[0]!
    const additional = isAdditional(first.tool)
    const level = first.itemLevel ?? gear.get(first.item)?.requiredLevel ?? null
    const tiers: PotentialTier[] = []
    let tries = 0
    let meso = 0
    for (const d of list) {
      tries++
      meso += eventMeso(d, level) ?? 0
      if (d.success && d.grade) {
        tiers.push({ from: d.beforeGrade ?? null, to: d.grade, tries, at: d.at.toISOString() })
        tries = 0
      }
    }
    // 기간 첫 기록 전에 같은 등급에서 이미 돌린 횟수(천장). 마지막으로 등급이 오른 뒤부터 센다
    const side = additional ? /에디셔널/ : { $not: /에디셔널/ }
    const lastUp = await enhanceEvents.findOne({ userId, character, item: first.item, kind: { $in: ['cube', 'potential'] }, tool: side, success: true, at: { $lt: first.at } }, { sort: { at: -1 }, projection: { at: 1 } })
    const stackBefore = await enhanceEvents.countDocuments({ userId, character, item: first.item, kind: { $in: ['cube', 'potential'] }, tool: side, at: { $lt: first.at, ...(lastUp && { $gt: lastUp.at }) } })

    const last = list.at(-1)!
    const optionsOf = (d: EnhanceEventDoc) => (additional ? d.addOptions : d.options)
    const options = optionsOf(last)
    // 마지막 등급이 된 뒤의 시도 중 지금 옵션이 마지막으로 뜬 번째(재설정은 이전 옵션을 고를 수 있어 마지막으로 본다)
    const since = tiers.at(-1)?.at
    const run = since ? list.filter(d => d.at.toISOString() >= since) : list
    const target = options.join('|')
    const at = run.findLastIndex(d => optionsOf(d).join('|') === target)
    const g = gear.get(first.item)
    return {
      item: first.item,
      slot: g?.slot ?? null,
      icon: g?.icon ?? null,
      level,
      additional,
      tools: [...Map.groupBy(list, d => (d.kind === 'potential' ? '메소 재설정' : d.tool ?? '큐브'))].map(([name, l]) => ({ name, count: l.length })),
      meso,
      fromGrade: first.beforeGrade ?? null,
      toGrade: last.grade,
      stackBefore,
      tiers,
      optionTries: run.length,
      optionAt: at < 0 ? null : at + 1,
      optionTime: at < 0 ? null : run[at]!.at.toISOString(),
      options,
      first: first.at.toISOString(),
      last: last.at.toISOString(),
      manual: manual.potential.get(first.item) ?? null,
    }
  }))
}
