import type { ObjectId } from 'mongodb'
import type { CharacterBrief, EnhanceEvent, EnhanceKind, EnhanceSummary, PotentialDay, PotentialDetail, PotentialTier, StarforceDay, StarforceDetail, StarforceStage } from '#shared/types'
import { POTENTIAL_GRADES, resetCost, type PotentialGrade } from '#shared/data/potential'
import { PROTECT_EXTRA, STARFORCE_REVAMP_DATE, baseCost } from '#shared/data/starforce'
import type { EnhanceEventDoc } from './mongo'
import type { NexonHistoryEvent } from './nexon'

// 오래된 기록은 지금 낀 장비와 상관없을 때가 많고 넥슨 호출만 많이 들어 반년까지만 모은다
const HISTORY_BACKFILL_DAYS = 180
const SYNC_LOCK_MS = 60 * 1000
// 오늘 기록을 다시 받는 간격. 기간 버튼을 누를 때마다 넥슨을 부르면 화면이 느려진다
const TODAY_SYNC_MS = 3 * 60 * 1000
// 받는 필드가 바뀐 버전. 이보다 낮으면 처음부터 다시 받아 채운다 (2: 쓴 메소 계산용 필드, 3: 에디셔널 등급)
const SYNC_VERSION = 3

function toDoc(userId: ObjectId, kind: EnhanceKind, e: NexonHistoryEvent): EnhanceEventDoc {
  const result = e.item_upgrade_result ?? ''
  const additional = (e.potential_type ?? e.cube_type ?? '').includes('에디셔널')
  return {
    userId,
    eventId: e.id,
    kind,
    character: e.character_name,
    item: e.target_item,
    at: new Date(e.date_create),
    // 스타포스는 '성공', 큐브·재설정은 등급이 오른 경우 '성공'으로 온다
    success: result === '성공',
    destroyed: result.includes('파괴'),
    beforeStar: e.before_starforce_count ?? null,
    afterStar: e.after_starforce_count ?? null,
    tool: e.cube_type ?? e.potential_type ?? null,
    // 에디셔널 큐브·재설정은 아랫잠 등급을 따로 보내 준다. 윗잠 등급을 쓰면 아랫잠이 낮아도 윗잠 등급으로 보인다
    grade: (additional ? e.additional_potential_option_grade ?? e.after_additional_potential_option?.[0]?.grade : e.potential_option_grade) ?? null,
    options: (e.after_potential_option ?? []).map(o => o.value),
    addOptions: (e.after_additional_potential_option ?? []).map(o => o.value),
    itemLevel: e.item_level ?? null,
    // 첫 줄 등급이 곧 장비 등급이다
    beforeGrade: ((additional ? e.before_additional_potential_option : e.before_potential_option) ?? [])[0]?.grade ?? null,
    protect: !!e.destroy_defence && !e.destroy_defence.includes('미적용'),
    superior: !!e.superior_item_flag && !e.superior_item_flag.includes('미해당'),
    scroll: !!e.upgrade_item,
    eventDiscount: Math.max(0, ...(e.starforce_event_list ?? []).map(ev => Number(ev.cost_discount_rate) || 0)) / 100,
  }
}

async function syncDay(userId: ObjectId, apiKey: string, date: string) {
  const { enhanceEvents } = await useCollections()
  // 지난날을 이어서 모을 땐 하루에 세 번씩 연달아 부르므로 키 호출 한도에 걸리지 않게 차례로 부른다
  const docs = [
    ...(await nexonHistory.starforce(apiKey, date)).map(e => toDoc(userId, 'starforce', e)),
    ...(await nexonHistory.cube(apiKey, date)).map(e => toDoc(userId, 'cube', e)),
    ...(await nexonHistory.potential(apiKey, date)).map(e => toDoc(userId, 'potential', e)),
  ]
  if (!docs.length) return
  await enhanceEvents.bulkWrite(docs.map(d => ({
    updateOne: { filter: { userId, eventId: d.eventId }, update: { $set: d }, upsert: true },
  })), { ordered: false })
}

// 접속할 때마다 정해진 시간만큼 모은다. 새로 생긴 날(최근)을 먼저 채우고 남는 시간에 지난날을 거꾸로 채운다
export async function syncEnhanceHistory(userId: ObjectId, budgetMs: number) {
  const { historySync } = await useCollections()
  const now = new Date()
  const lock = await historySync.findOneAndUpdate(
    { _id: userId, $or: [{ lockedAt: null }, { lockedAt: { $lt: new Date(now.getTime() - SYNC_LOCK_MS) } }] },
    { $set: { lockedAt: now }, $setOnInsert: { oldest: null, newest: null, done: false } },
    { upsert: true, returnDocument: 'after' },
  ).catch(() => null)
  // 다른 요청이 이미 모으는 중이면(잠금 때문에 upsert가 겹쳐 실패) 겹치지 않게 넘어간다
  if (!lock) return

  const yesterday = kstYesterday()
  const limit = addDays(yesterday, -HISTORY_BACKFILL_DAYS)
  const deadline = Date.now() + budgetMs
  let { oldest, newest, done, todayAt = null } = lock
  if ((lock.version ?? 1) < SYNC_VERSION) [oldest, newest, done] = [null, null, false]
  const todayFresh = !!todayAt && now.getTime() - todayAt.getTime() < TODAY_SYNC_MS
  // 기간 버튼만 바꿔 다시 부른 경우처럼 받을 게 없으면 넥슨을 부르지 않고 잠금만 푼다
  if (todayFresh && done && newest === yesterday) {
    await historySync.updateOne({ _id: userId }, { $set: { lockedAt: null } })
    return
  }

  const apiKey = await getUserApiKey(userId)
  try {
    // 오늘 기록은 계속 늘어나니 몇 분마다 다시 받는다. 이미 받은 건 eventId로 덮어쓴다
    if (!todayFresh) {
      await syncDay(userId, apiKey, kstToday())
      todayAt = new Date()
    }
    let date = newest ? addDays(newest, 1) : yesterday
    while (newest !== null && date <= yesterday && Date.now() < deadline) {
      await syncDay(userId, apiKey, date)
      newest = date
      date = addDays(date, 1)
    }
    date = oldest ? addDays(oldest, -1) : yesterday
    while (!done && Date.now() < deadline) {
      if (date < limit || date < NEXON_DATA_START_DATE) {
        done = true
        break
      }
      await syncDay(userId, apiKey, date)
      oldest = date
      newest ??= date
      date = addDays(date, -1)
    }
  }
  catch (error) {
    // 넥슨이 그 날짜는 조회할 수 없다고 하면 더 이전 기록은 없는 것이라 끝낸다
    if (error instanceof NexonError && error.code === NEXON_ERROR.INVALID_PARAMETER) done = true
    else console.warn('[enhance] 강화 기록 모으기 중단', redactApiKeys(String(error)))
  }
  finally {
    await historySync.updateOne({ _id: userId }, { $set: { oldest, newest, done, todayAt, lockedAt: null, version: SYNC_VERSION } })
  }
}

const kstDate = (at: Date) => new Date(at.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)

// 잠재 메소 재설정은 공식 비용표로, 스타포스는 장비 레벨로 비용 공식을 써서 추정한다(MVP·PC방 할인과 복구 비용은 기록에 없어 빠짐)
// 큐브·주문서·슈페리얼은 메소를 안 셈
export function eventMeso(doc: Pick<EnhanceEventDoc, 'kind' | 'at' | 'beforeStar' | 'beforeGrade' | 'itemLevel' | 'tool' | 'scroll' | 'superior' | 'protect' | 'eventDiscount'>, starforceLevel: number | null): number | null {
  if (doc.kind === 'potential') {
    const grade = doc.beforeGrade as PotentialGrade
    return doc.itemLevel && POTENTIAL_GRADES.includes(grade) ? resetCost(isAdditional(doc.tool), doc.itemLevel, grade) : null
  }
  if (doc.kind !== 'starforce' || doc.scroll || doc.superior || doc.beforeStar === null || !starforceLevel) return null
  const base = baseCost(starforceLevel, doc.beforeStar, kstDate(doc.at) < STARFORCE_REVAMP_DATE)
  return Math.round(base * (1 - (doc.eventDiscount ?? 0))) + (doc.protect ? base * PROTECT_EXTRA : 0)
}

// 에디셔널 큐브·에디셔널 재설정은 이름에 '에디셔널'이 들어 있다
const isAdditional = (tool: string | null) => !!tool?.includes('에디셔널')

export const emptySummary = (): EnhanceSummary => ({
  starforce: { attempts: 0, success: 0, destroy: 0, protect: 0 },
  potential: { cubes: 0, resets: 0 },
  additional: { cubes: 0, resets: 0 },
  meso: { starforce: 0, potential: 0, additional: 0 },
  first: null,
  last: null,
})

function toEvent(doc: EnhanceEventDoc, meso: number | null): EnhanceEvent {
  return {
    kind: doc.kind,
    at: doc.at.toISOString(),
    success: doc.success,
    destroyed: doc.destroyed,
    beforeStar: doc.beforeStar,
    afterStar: doc.afterStar,
    tool: doc.tool,
    additional: isAdditional(doc.tool),
    grade: doc.grade,
    options: doc.options,
    addOptions: doc.addOptions,
    meso,
    // 쓴 메소 필드를 받기 전(버전 1)에 저장된 기록엔 없다
    protect: doc.protect ?? false,
    eventDiscount: doc.eventDiscount ?? 0,
  }
}

// 강화 기록은 계정 단위라 내 계정 캐릭터만 볼 수 있게 한다
export async function ownCharacter(userId: ObjectId, ocid: string | undefined, apiKey: () => Promise<string>): Promise<CharacterBrief> {
  const character = (await accountCharacters(userId, apiKey)).find(c => c.ocid === ocid)
  if (!character) throw createError({ statusCode: 404, message: '내 계정의 캐릭터만 볼 수 있어요.' })
  return character
}

const sinceFilter = (from: string | null) => (from ? { at: { $gte: kstDayStart(from) } } : {})

// 비용이 같게 나오는 기록끼리 DB에서 묶어 센다. 반년치 수천 건을 다 받아 오면 느려서
type CostGroup = Pick<EnhanceEventDoc, 'item' | 'kind' | 'success' | 'destroyed' | 'beforeStar' | 'beforeGrade' | 'itemLevel' | 'tool' | 'protect' | 'superior' | 'scroll' | 'eventDiscount'>

// 넥슨 기록엔 아이템 고유 번호가 없어서 같은 캐릭터·같은 이름으로 묶는다. 기록 목록은 장비를 고를 때 starforceDetail·potentialDetail로 따로 받는다
export async function summariesByItem(userId: ObjectId, character: string, items: { name: string, level: number | null }[], from: string | null): Promise<Map<string, EnhanceSummary>> {
  const { enhanceEvents } = await useCollections()
  const levels = new Map(items.map(i => [i.name, i.level]))
  const groups = await enhanceEvents.aggregate<{ _id: CostGroup & { legacy: boolean }, count: number, first: Date, last: Date }>([
    { $match: { userId, character, item: { $in: [...levels.keys()] }, ...sinceFilter(from) } },
    { $group: {
      _id: {
        item: '$item', kind: '$kind', success: '$success', destroyed: '$destroyed', beforeStar: '$beforeStar', beforeGrade: '$beforeGrade', itemLevel: '$itemLevel',
        tool: '$tool', protect: '$protect', superior: '$superior', scroll: '$scroll', eventDiscount: '$eventDiscount',
        // 스타포스 비용표가 바뀐 날 전후로 비용이 달라 따로 묶는다
        legacy: { $lt: ['$at', kstDayStart(STARFORCE_REVAMP_DATE)] },
      },
      count: { $sum: 1 },
      first: { $min: '$at' },
      last: { $max: '$at' },
    } },
  ]).toArray()

  const result = new Map<string, EnhanceSummary>()
  for (const { _id: g, count, first, last } of groups) {
    const s = result.get(g.item) ?? result.set(g.item, emptySummary()).get(g.item)!
    // 묶음 안에선 비용이 같으므로 대표 시각 하나로 한 번만 계산한다
    const meso = (eventMeso({ ...g, at: first }, levels.get(g.item) ?? null) ?? 0) * count
    if (g.kind === 'starforce') {
      s.starforce.attempts += count
      if (g.success) s.starforce.success += count
      if (g.destroyed) s.starforce.destroy += count
      if (g.protect) s.starforce.protect += count
      s.meso.starforce += meso
    }
    else {
      const side = isAdditional(g.tool) ? 'additional' : 'potential'
      if (g.kind === 'cube') s[side].cubes += count
      else s[side].resets += count
      s.meso[side] += meso
    }
    if (!s.first || first.toISOString() < s.first) s.first = first.toISOString()
    if (!s.last || last.toISOString() > s.last) s.last = last.toISOString()
  }
  return result
}

// 반년 동안 한 장비에 이보다 많이 누르는 일은 드물다. 넘으면 오래된 날부터 잘린다
const MAX_DETAIL_EVENTS = 3000

// 한 장비의 스타포스 기록을 ★ 구간별과 날짜별로 묶는다
export async function starforceDetail(userId: ObjectId, character: string, item: string, level: number | null, from: string | null): Promise<StarforceDetail> {
  const { enhanceEvents } = await useCollections()
  const docs = await enhanceEvents
    .find({ userId, character, item, kind: 'starforce', ...sinceFilter(from) })
    .sort({ at: -1 })
    .limit(MAX_DETAIL_EVENTS + 1)
    .toArray()
  const truncated = docs.length > MAX_DETAIL_EVENTS
  if (truncated) docs.pop()

  const stages = new Map<number, StarforceStage>()
  const days = new Map<string, StarforceDay>()
  for (const doc of docs) {
    const meso = eventMeso(doc, level)
    if (doc.beforeStar !== null) {
      const stage = stages.get(doc.beforeStar) ?? stages.set(doc.beforeStar, { star: doc.beforeStar, attempts: 0, success: 0, fail: 0, destroy: 0, protect: 0, meso: 0 }).get(doc.beforeStar)!
      stage.attempts++
      if (doc.success) stage.success++
      else if (doc.destroyed) stage.destroy++
      else stage.fail++
      if (doc.protect) stage.protect++
      stage.meso += meso ?? 0
    }
    const date = kstDate(doc.at)
    const day = days.get(date) ?? days.set(date, { date, attempts: 0, success: 0, destroy: 0, meso: 0, fromStar: null, toStar: null, events: [] }).get(date)!
    day.attempts++
    if (doc.success) day.success++
    if (doc.destroyed) day.destroy++
    day.meso += meso ?? 0
    // 최신순으로 돌므로 처음 만난 기록이 그날 마지막, 마지막으로 만난 기록이 그날 처음이다
    day.toStar ??= doc.afterStar
    day.fromStar = doc.beforeStar
    day.events.push(toEvent(doc, meso))
  }
  return {
    stages: [...stages.values()].sort((a, b) => a.star - b.star),
    days: [...days.values()],
    truncated,
  }
}

// 한 장비의 윗잠 또는 에디 기록을 등급 상승 단계별과 날짜별로 묶는다
export async function potentialDetail(userId: ObjectId, character: string, item: string, level: number | null, from: string | null, additional: boolean): Promise<PotentialDetail> {
  const { enhanceEvents } = await useCollections()
  // 최근 것을 기준으로 자르고, 등급 단계는 오래된 것부터 세야 해서 받은 뒤 뒤집는다
  const docs = await enhanceEvents
    .find({ userId, character, item, kind: { $in: ['cube', 'potential'] }, tool: additional ? /에디셔널/ : { $not: /에디셔널/ }, ...sinceFilter(from) })
    .sort({ at: -1 })
    .limit(MAX_DETAIL_EVENTS + 1)
    .toArray()
  const truncated = docs.length > MAX_DETAIL_EVENTS
  if (truncated) docs.pop()

  const days = new Map<string, PotentialDay>()
  for (const doc of docs) {
    const meso = eventMeso(doc, level)
    const date = kstDate(doc.at)
    const day = days.get(date) ?? days.set(date, { date, cubes: 0, resets: 0, meso: 0, ups: 0, events: [] }).get(date)!
    if (doc.kind === 'cube') day.cubes++
    else day.resets++
    if (doc.success) day.ups++
    day.meso += meso ?? 0
    day.events.push(toEvent(doc, meso))
  }

  const tiers: PotentialTier[] = []
  let tries = 0
  let since: Date | null = docs.at(-1)?.at ?? null
  for (const doc of docs.toReversed()) {
    tries++
    if (doc.success && doc.grade) {
      tiers.push({ from: doc.beforeGrade ?? null, to: doc.grade, tries, at: doc.at.toISOString() })
      tries = 0
      since = doc.at
    }
  }
  return {
    tiers,
    current: { grade: docs[0]?.grade ?? null, tries, since: since?.toISOString() ?? null },
    days: [...days.values()],
    truncated,
  }
}
