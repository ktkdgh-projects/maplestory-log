import type { ObjectId } from 'mongodb'
import type { EquipmentItem, PotentialTier, ReviewOwner, ReviewPotential, ReviewStarforce } from '#shared/types'
import { PROTECT_STARS } from '#shared/data/starforce'
import type { EnhanceEventDoc } from './mongo'

// 날짜 칩에 점을 찍고 가장 가까운 기록 날을 찾을 만큼만 본다
const RECORD_DAYS_BACK = 60
// 결산 한 번에 볼 수 있는 기간. 이번 주·썬데이보다 넉넉하게, 반년치를 한 번에 묶지는 않게
const REVIEW_MAX_DAYS = 31

interface Range { from: string, to: string }
const rangeFilter = (range: Range) => ({ at: { $gte: kstDayStart(range.from), $lt: kstDayStart(addDays(range.to, 1)) } })

export function parseReviewRange(query: { from?: unknown, to?: unknown }, today = kstToday()): Range {
  const from = query.from ? parseDate(query.from) : today
  const to = query.to ? parseDate(query.to) : from
  if (to < from || addDays(from, REVIEW_MAX_DAYS - 1) < to) throw createError({ statusCode: 400, message: '기간을 다시 골라 주세요.' })
  return { from, to }
}

export async function hasRecords(userId: ObjectId, names: string[], range: Range) {
  const { enhanceEvents } = await useCollections()
  return !!(await enhanceEvents.findOne({ userId, character: { $in: names }, ...rangeFilter(range) }, { projection: { _id: 1 } }))
}

// 장비 결산에서 이 캐릭터·장비에 이 기간 날짜로 직접 적은 강화 비용
async function manualCosts(userId: ObjectId, names: string[], range: Range) {
  const { itemSheets, itemRows } = await useCollections()
  const sheets = await itemSheets.find({ userId, characterName: { $in: names } }, { projection: { _id: 1 } }).toArray()
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
  const docs = await sundays.find({ start: { $lt: kstDayStart(addDays(range.to, 1)) }, end: { $gte: kstDayStart(addDays(range.from, -1)) } }, { projection: { start: 1, end: 1, effects: 1 } }).toArray()
  return (at: Date) => docs.find(s => inSunday(at, s))?.effects ?? []
}

export async function recordDays(userId: ObjectId, names: string[], today: string): Promise<string[]> {
  const { enhanceEvents } = await useCollections()
  const days = await enhanceEvents.aggregate<{ _id: string }>([
    { $match: { userId, character: { $in: names }, at: { $gte: kstDayStart(addDays(today, -RECORD_DAYS_BACK)) } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$at', timezone: 'Asia/Seoul' } } } },
    { $sort: { _id: -1 } },
  ]).toArray()
  return days.map(d => d._id)
}

const toolName = (d: Pick<EnhanceEventDoc, 'kind' | 'tool'>) => (d.kind === 'potential' ? '메소 재설정' : d.tool ?? '큐브')
// 이름은 달라도(카르마·대적자 등) 확률·천장이 같은 도구끼리 한 묶음. 결산 계산기의 도구 구분(methodOfTool)과 같은 기준이다
const TOOL_FAMILIES = ['블랙 큐브', '레드 큐브', '에디셔널 큐브']
const toolFamily = (name: string) => TOOL_FAMILIES.find(f => name.includes(f)) ?? name
const monthDay = (at: Date) => kstDateOf(at).slice(5).split('-').map(Number).join('/')

// 썬데이·할인 이벤트와 평소가 섞이거나 그 사이 MVP 등급을 바꾸면 기대값 조건이 달라 같은 장비도 조건별로 나눈다
export async function reviewStarforce(userId: ObjectId, owner: ReviewOwner, names: string[], range: Range, equipped: EquipmentItem[], mvp: MvpTimeline): Promise<ReviewStarforce[]> {
  const { enhanceEvents } = await useCollections()
  const match = { character: { $in: names } }
  const docs = await enhanceEvents.find({ userId, kind: 'starforce', ...match, ...rangeFilter(range) }).sort({ at: 1 }).toArray()
  if (!docs.length) return []
  const gear = new Map(equipped.map(i => [i.name, i]))
  const levelOf = (item: string) => gear.get(item)?.requiredLevel || null
  const [restores, effectsAt, manual] = await Promise.all([
    restoresOf(userId, match, levelOf, kstDayStart(range.from), kstDayStart(addDays(range.to, 1))),
    sundayEffectsIn(range),
    manualCosts(userId, names, range),
  ])
  const restoreOf = new Map(restores.map(r => [r.eventId, r.restore]))

  const parts = [...Map.groupBy(docs.filter(d => d.beforeStar !== null && !d.scroll), d => d.item)].flatMap(([item, all]) => {
    const groups = [...Map.groupBy(all, d => `${[...effectsAt(d.at)].sort().join(',')}|${(d.eventDiscount ?? 0) > 0}|${mvp.at(d.at)}`).values()]
    return groups.map(list => ({ item, list, split: groups.length > 1 }))
  })
  return parts.map(({ item, list, split }) => {
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
      meso += eventMeso(d, level, mvp.at(d.at)) ?? 0
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
    const firstDoc = list[0]!
    const lastDoc = list.at(-1)!
    if (tries) path.push({ star: lastDoc.beforeStar!, tries, result: 'stop', restore: null })
    const g = gear.get(item)
    const sundayEffects = effectsAt(firstDoc.at)
    const discount = (firstDoc.eventDiscount ?? 0) > 0
    return {
      character: owner,
      item,
      slot: g?.slot ?? null,
      icon: g?.icon ?? null,
      level,
      from: firstDoc.beforeStar!,
      to: lastDoc.afterStar ?? lastDoc.beforeStar!,
      attempts: list.length,
      destroys: list.filter(d => d.destroyed).length,
      meso,
      restoreMeso,
      copies,
      protectStars: [...protectStars].sort((a, b) => a - b),
      discount,
      sundayEffects,
      mvp: mvp.at(firstDoc.at),
      condition: split ? `${sundayEffects.length ? '썬데이' : discount ? '할인 이벤트' : '평소'} ${monthDay(firstDoc.at)}~` : null,
      stages: [...stages.values()].sort((a, b) => a.star - b.star),
      path,
      first: firstDoc.at.toISOString(),
      last: lastDoc.at.toISOString(),
      // 조건별로 나눈 장비는 장비 결산에 적은 값을 어느 쪽에 넣을지 몰라 기록으로 센 값으로 비교한다
      manual: split ? null : manual.starforce.get(item) ?? null,
    }
  })
}

// 기간 첫 기록 전에 같은 등급에서 이미 돌린 횟수(천장). 천장은 도구 묶음마다 따로 쌓여서 마지막으로 등급이 오른 뒤 같은 묶음으로 돌린 것만 센다
async function stacksBefore(userId: ObjectId, names: string[], since: Date, wanted: { item: string, additional: boolean, tool: string }[]) {
  if (!wanted.length) return new Map<string, number>()
  const { enhanceEvents } = await useCollections()
  const additional = { $regexMatch: { input: { $ifNull: ['$tool', ''] }, regex: '에디셔널' } }
  const base = { userId, character: { $in: names }, item: { $in: [...new Set(wanted.map(w => w.item))] }, kind: { $in: ['cube', 'potential'] }, at: { $lt: since } }
  const ups = await enhanceEvents.aggregate<{ _id: { item: string, additional: boolean }, at: Date }>([
    { $match: { ...base, success: true } },
    { $group: { _id: { item: '$item', additional }, at: { $max: '$at' } } },
  ]).toArray()
  const upAt = new Map(ups.map(u => [`${u._id.item}\n${u._id.additional}`, u.at]))
  const counts = await enhanceEvents.aggregate<{ _id: { item: string, additional: boolean, tool: string }, count: number }>([
    { $match: base },
    { $addFields: { additional, family: { $switch: {
      branches: [
        { case: { $eq: ['$kind', 'potential'] }, then: '메소 재설정' },
        ...TOOL_FAMILIES.map(f => ({ case: { $regexMatch: { input: { $ifNull: ['$tool', ''] }, regex: f } }, then: f })),
      ],
      default: { $ifNull: ['$tool', '큐브'] },
    } } } },
    { $match: { $or: wanted.map((w) => {
      const up = upAt.get(`${w.item}\n${w.additional}`)
      return { item: w.item, additional: w.additional, family: toolFamily(w.tool), ...(up && { at: { $gt: up } }) }
    }) } },
    { $group: { _id: { item: '$item', additional: '$additional', tool: '$family' }, count: { $sum: 1 } } },
  ]).toArray()
  return new Map(counts.map(c => [`${c._id.item}\n${c._id.additional}\n${c._id.tool}`, c.count]))
}

export async function reviewPotential(userId: ObjectId, owner: ReviewOwner, names: string[], range: Range, equipped: EquipmentItem[]): Promise<ReviewPotential[]> {
  const { enhanceEvents } = await useCollections()
  const docs = await enhanceEvents.find({ userId, character: { $in: names }, kind: { $in: ['cube', 'potential'] }, ...rangeFilter(range) }).sort({ at: 1 }).toArray()
  if (!docs.length) return []
  const gear = new Map(equipped.map(i => [i.name, i]))
  const groups = [...Map.groupBy(docs, d => `${d.item}\n${isAdditional(d.tool)}`).values()].map((list) => {
    // 결산 계산은 가장 많이 쓴 도구(같은 수면 먼저 쓴 것) 기준이라 천장도 그 도구로 센다
    const tools = [...Map.groupBy(list, toolName)].map(([name, l]) => ({ name, count: l.length }))
    return { list, tools, main: [...tools].sort((a, b) => b.count - a.count)[0]!.name }
  })
  const [manual, stacks] = await Promise.all([
    manualCosts(userId, names, range),
    stacksBefore(userId, names, kstDayStart(range.from), groups.map(g => ({ item: g.list[0]!.item, additional: isAdditional(g.list[0]!.tool), tool: g.main }))),
  ])

  return groups.map(({ list, tools, main }) => {
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
      character: owner,
      item: first.item,
      slot: g?.slot ?? null,
      icon: g?.icon ?? null,
      level,
      additional,
      tools,
      meso,
      fromGrade: first.beforeGrade ?? null,
      toGrade: last.grade,
      stackBefore: stacks.get(`${first.item}\n${additional}\n${toolFamily(main)}`) ?? 0,
      tiers,
      optionTries: run.length,
      optionAt: at < 0 ? null : at + 1,
      optionTime: at < 0 ? null : run[at]!.at.toISOString(),
      options,
      first: first.at.toISOString(),
      last: last.at.toISOString(),
      manual: manual.potential.get(first.item) ?? null,
    }
  })
}
