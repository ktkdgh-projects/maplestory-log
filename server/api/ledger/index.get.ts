import type { HuntDrops, LedgerResponse } from '#shared/types'

const MONTH_PATTERN = /^\d{4}-\d{2}$/

export default defineEventHandler(async (event): Promise<LedgerResponse> => {
  const user = requireUser(event)
  const query = getQuery(event).month
  const month = typeof query === 'string' && MONTH_PATTERN.test(query) ? query : kstToday().slice(0, 7)
  const range = { $gte: `${month}-01`, $lte: `${month}-31` }

  const { hunts, bossClears, dropSales, mesoEntries } = await useCollections()
  const [huntDocs, clearDocs, items, saleDocs, entryDocs, gained, sold] = await Promise.all([
    hunts.find({ userId: user._id, date: range }).sort({ date: 1, createdAt: 1 }).toArray(),
    bossClears.find({ userId: user._id, date: range }).sort({ date: 1 }).toArray(),
    itemFlows(user._id, { from: `${month}-01`, to: `${month}-31` }),
    dropSales.find({ userId: user._id, date: range }).sort({ date: 1, createdAt: 1 }).toArray(),
    mesoEntries.find({ userId: user._id, date: range }).sort({ date: 1, createdAt: 1 }).toArray(),
    // 남은 재료 개수는 달과 상관없이 처음 기록부터 센다
    hunts.aggregate<HuntDrops>([
      { $match: { userId: user._id } },
      { $group: { _id: null, fragments: { $sum: '$fragments' }, traces: { $sum: '$traces' } } },
    ]).toArray(),
    dropSales.aggregate<{ _id: keyof HuntDrops, count: number }>([
      { $match: { userId: user._id } },
      { $group: { _id: '$item', count: { $sum: '$count' } } },
    ]).toArray(),
  ])
  const soldOf = (item: keyof HuntDrops) => sold.find(s => s._id === item)?.count ?? 0
  return {
    month,
    hunts: huntDocs.map(toHuntEntry),
    clears: clearDocs.map(toBossClear),
    items,
    sales: saleDocs.map(toDropSale),
    entries: entryDocs.map(toMesoEntry),
    stock: {
      fragments: (gained[0]?.fragments ?? 0) - soldOf('fragments'),
      traces: (gained[0]?.traces ?? 0) - soldOf('traces'),
    },
  }
})
