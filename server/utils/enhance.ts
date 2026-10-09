import type { ObjectId } from 'mongodb'
import type { EnhanceEvent, EnhanceKind, EnhanceSummary } from '#shared/types'
import type { EnhanceEventDoc } from './mongo'
import type { NexonHistoryEvent } from './nexon'

// 오래된 기록은 지금 낀 장비와 상관없을 때가 많고 넥슨 호출만 많이 들어 반년까지만 모은다
const HISTORY_BACKFILL_DAYS = 180
const SYNC_LOCK_MS = 60 * 1000
const MAX_EVENTS_PER_ITEM = 300

function toDoc(userId: ObjectId, kind: EnhanceKind, e: NexonHistoryEvent): EnhanceEventDoc {
  const result = e.item_upgrade_result ?? ''
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
    updateOne: { filter: { userId, eventId: d.eventId }, update: { $setOnInsert: d }, upsert: true },
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
  try {
    // 오늘 기록은 계속 늘어나니 매번 다시 받는다. 이미 받은 건 eventId로 걸러진다
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
    await historySync.updateOne({ _id: userId }, { $set: { oldest, newest, done, lockedAt: null } })
  }
}

function toEvent(doc: EnhanceEventDoc): EnhanceEvent {
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
  }
}

export function summarize(events: EnhanceEvent[]): EnhanceSummary {
  const starforce = events.filter(e => e.kind === 'starforce')
  return {
    starforce: { attempts: starforce.length, success: starforce.filter(e => e.success).length, destroy: starforce.filter(e => e.destroyed).length },
    cubes: events.filter(e => e.kind === 'cube').length,
    resets: events.filter(e => e.kind === 'potential').length,
    first: events.at(-1)?.at ?? null,
    last: events[0]?.at ?? null,
  }
}

// 넥슨 기록엔 아이템 고유 번호가 없어서 같은 캐릭터·같은 이름으로 묶는다. 최근 것부터
export async function eventsByItem(userId: ObjectId, character: string, items: string[], from: string | null): Promise<Map<string, EnhanceEvent[]>> {
  const { enhanceEvents } = await useCollections()
  const docs = await enhanceEvents.find({ userId, character, item: { $in: items }, ...(from && { at: { $gte: kstDayStart(from) } }) }).sort({ at: -1 }).toArray()
  const map = new Map<string, EnhanceEvent[]>()
  for (const doc of docs) {
    const list = map.get(doc.item) ?? map.set(doc.item, []).get(doc.item)!
    if (list.length < MAX_EVENTS_PER_ITEM) list.push(toEvent(doc))
  }
  return map
}
