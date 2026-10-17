import type { LedgerResponse, LedgerWeekDay } from '#shared/types'
import { lootMeso } from '#shared/calc/boss'
import { bossPeriod } from '#shared/data/bosses'

const MONTH_PATTERN = /^\d{4}-\d{2}$/

export default defineEventHandler(async (event): Promise<LedgerResponse> => {
  const user = requireUser(event)
  const query = getQuery(event).month
  const month = typeof query === 'string' && MONTH_PATTERN.test(query) && realDate(`${query}-01`) ? query : kstToday().slice(0, 7)
  const range = { $gte: `${month}-01`, $lte: `${month}-31` }
  // 주간 카드는 목요일부터 세므로 달 앞뒤로 걸친 주까지 받는다
  const weekRange = { $gte: bossPeriod('weekly', `${month}-01`), $lte: addDays(`${month}-01`, 37) }

  const { hunts, bossClears, dropSales, mesoEntries } = await useCollections()
  const [huntDocs, clearDocs, itemEvents, saleDocs, entryDocs, weekHunts, weekClears] = await Promise.all([
    hunts.find({ userId: user._id, date: range }).sort({ date: 1, createdAt: 1 }).toArray(),
    bossClears.find({ userId: user._id, date: range }).sort({ date: 1 }).toArray(),
    itemFlowEvents(user._id, { from: `${month}-01`, to: `${month}-31` }),
    dropSales.find({ userId: user._id, date: range }).sort({ date: 1, createdAt: 1 }).toArray(),
    mesoEntries.find({ userId: user._id, date: range }).sort({ date: 1, createdAt: 1 }).toArray(),
    hunts.find({ userId: user._id, date: weekRange }, { projection: { date: 1, meso: 1, minutes: 1, fragments: 1, traces: 1 } }).toArray(),
    bossClears.find({ userId: user._id, date: weekRange }, { projection: { date: 1, meso: 1, loot: 1 } }).toArray(),
  ])
  const weekDays: Record<string, LedgerWeekDay> = {}
  const day = (date: string) => (weekDays[date] ??= { hunt: 0, minutes: 0, fragments: 0, traces: 0, crystal: 0, loot: 0, clears: 0 })
  for (const h of weekHunts) {
    const d = day(h.date)
    d.hunt += h.meso
    d.minutes += h.minutes ?? 0
    d.fragments += h.fragments
    d.traces += h.traces
  }
  for (const c of weekClears) {
    const d = day(c.date)
    d.crystal += c.meso
    d.loot += lootMeso({ loot: bossLootOf(c) })
    d.clears++
  }
  return {
    month,
    hunts: huntDocs.map(toHuntEntry),
    clears: clearDocs.map(toBossClear),
    items: sumItemFlows(itemEvents),
    itemLines: (await withItemIcons(itemEvents)).map(({ at: _at, ...line }) => line),
    sales: saleDocs.map(toDropSale),
    entries: await toMesoEntries(entryDocs),
    weekDays,
  }
})
