import type { LedgerResponse } from '#shared/types'
import { bossPeriod } from '#shared/data/bosses'

const MONTH_PATTERN = /^\d{4}-\d{2}$/

export default defineEventHandler(async (event): Promise<LedgerResponse> => {
  const user = requireUser(event)
  const query = getQuery(event).month
  const month = typeof query === 'string' && MONTH_PATTERN.test(query) && realDate(`${query}-01`) ? query : kstToday().slice(0, 7)
  const range = { $gte: `${month}-01`, $lte: `${month}-31` }
  // 주간 조각은 목요일부터 세므로 달 앞뒤로 걸친 주까지 받는다
  const weekRange = { $gte: bossPeriod('weekly', `${month}-01`), $lte: addDays(`${month}-01`, 37) }

  const { hunts, bossClears, dropSales, mesoEntries } = await useCollections()
  const [huntDocs, clearDocs, itemEvents, saleDocs, entryDocs, fragmentDays] = await Promise.all([
    hunts.find({ userId: user._id, date: range }).sort({ date: 1, createdAt: 1 }).toArray(),
    bossClears.find({ userId: user._id, date: range }).sort({ date: 1 }).toArray(),
    itemFlowEvents(user._id, { from: `${month}-01`, to: `${month}-31` }),
    dropSales.find({ userId: user._id, date: range }).sort({ date: 1, createdAt: 1 }).toArray(),
    mesoEntries.find({ userId: user._id, date: range }).sort({ date: 1, createdAt: 1 }).toArray(),
    hunts.aggregate<{ _id: string, fragments: number }>([
      { $match: { userId: user._id, date: weekRange, fragments: { $gt: 0 } } },
      { $group: { _id: '$date', fragments: { $sum: '$fragments' } } },
    ]).toArray(),
  ])
  return {
    month,
    hunts: huntDocs.map(toHuntEntry),
    clears: clearDocs.map(toBossClear),
    items: sumItemFlows(itemEvents),
    itemLines: (await withItemIcons(itemEvents)).map(({ at: _at, ...line }) => line),
    sales: saleDocs.map(toDropSale),
    entries: await toMesoEntries(entryDocs),
    fragmentsByDate: Object.fromEntries(fragmentDays.map(d => [d._id, d.fragments])),
  }
})
