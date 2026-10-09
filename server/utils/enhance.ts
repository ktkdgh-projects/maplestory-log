import type { ObjectId } from 'mongodb'
import type { EnhanceEvent, EnhanceKind, EnhanceSummary } from '#shared/types'
import { POTENTIAL_GRADES, resetCost, type PotentialGrade } from '#shared/data/potential'
import { PROTECT_EXTRA, STARFORCE_REVAMP_DATE, baseCost } from '#shared/data/starforce'
import type { EnhanceEventDoc } from './mongo'
import type { NexonHistoryEvent } from './nexon'

// 오래된 기록은 지금 낀 장비와 상관없을 때가 많고 넥슨 호출만 많이 들어 반년까지만 모은다
const HISTORY_BACKFILL_DAYS = 180
const SYNC_LOCK_MS = 60 * 1000
const MAX_EVENTS_PER_ITEM = 300
// 쓴 메소 계산용 필드를 받기 시작한 버전. 이보다 낮으면 처음부터 다시 받아 채운다
const SYNC_VERSION = 2

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
    grade: e.potential_option_grade ?? null,
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

  const apiKey = await getUserApiKey(userId)
  const yesterday = kstYesterday()
  const limit = addDays(yesterday, -HISTORY_BACKFILL_DAYS)
  const deadline = Date.now() + budgetMs
  let { oldest, newest, done } = lock
  if ((lock.version ?? 1) < SYNC_VERSION) [oldest, newest, done] = [null, null, false]
  try {
    // 오늘 기록은 계속 늘어나니 매번 다시 받는다. 이미 받은 건 eventId로 덮어쓴다
    await syncDay(userId, apiKey, kstToday())
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
    await historySync.updateOne({ _id: userId }, { $set: { oldest, newest, done, lockedAt: null, version: SYNC_VERSION } })
  }
}

const kstDate = (at: Date) => new Date(at.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)

// 잠재 메소 재설정은 공식 비용표로, 스타포스는 장비 레벨로 비용 공식을 써서 추정한다(MVP·PC방 할인과 복구 비용은 기록에 없어 빠짐)
// 큐브·주문서·슈페리얼은 메소를 안 셈
export function eventMeso(doc: EnhanceEventDoc, starforceLevel: number | null): number | null {
  if (doc.kind === 'potential') {
    const grade = doc.beforeGrade as PotentialGrade
    return doc.itemLevel && POTENTIAL_GRADES.includes(grade) ? resetCost(!!doc.tool?.includes('에디셔널'), doc.itemLevel, grade) : null
  }
  if (doc.kind !== 'starforce' || doc.scroll || doc.superior || doc.beforeStar === null || !starforceLevel) return null
  const base = baseCost(starforceLevel, doc.beforeStar, kstDate(doc.at) < STARFORCE_REVAMP_DATE)
  return Math.round(base * (1 - (doc.eventDiscount ?? 0))) + (doc.protect ? base * PROTECT_EXTRA : 0)
}

function toEvent(doc: EnhanceEventDoc, meso: number | null): EnhanceEvent {
  return {
    kind: doc.kind,
    at: doc.at.toISOString(),
    success: doc.success,
    destroyed: doc.destroyed,
    beforeStar: doc.beforeStar,
    afterStar: doc.afterStar,
    tool: doc.tool,
    grade: doc.grade,
    options: doc.options,
    addOptions: doc.addOptions,
    meso,
  }
}

function summarize(events: EnhanceEvent[]): EnhanceSummary {
  const starforce = events.filter(e => e.kind === 'starforce')
  const mesoOf = (kind: EnhanceKind) => events.reduce((n, e) => n + (e.kind === kind ? e.meso ?? 0 : 0), 0)
  return {
    starforce: { attempts: starforce.length, success: starforce.filter(e => e.success).length, destroy: starforce.filter(e => e.destroyed).length },
    cubes: events.filter(e => e.kind === 'cube').length,
    resets: events.filter(e => e.kind === 'potential').length,
    meso: { starforce: mesoOf('starforce'), potential: mesoOf('potential') },
    first: events.at(-1)?.at ?? null,
    last: events[0]?.at ?? null,
  }
}

// 넥슨 기록엔 아이템 고유 번호가 없어서 같은 캐릭터·같은 이름으로 묶는다. 요약은 전체로 내고 목록은 최근 것부터 잘라 보낸다
export async function eventsByItem(userId: ObjectId, character: string, items: { name: string, level: number | null }[], from: string | null) {
  const { enhanceEvents } = await useCollections()
  const levels = new Map(items.map(i => [i.name, i.level]))
  const docs = await enhanceEvents.find({ userId, character, item: { $in: [...levels.keys()] }, ...(from && { at: { $gte: kstDayStart(from) } }) }).sort({ at: -1 }).toArray()
  const all = new Map<string, EnhanceEvent[]>()
  for (const doc of docs) {
    const list = all.get(doc.item) ?? all.set(doc.item, []).get(doc.item)!
    list.push(toEvent(doc, eventMeso(doc, levels.get(doc.item) ?? null)))
  }
  return new Map([...all].map(([name, events]) => [name, { summary: summarize(events), events: events.slice(0, MAX_EVENTS_PER_ITEM) }]))
}
