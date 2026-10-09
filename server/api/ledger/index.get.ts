import type { ItemFlow, LedgerResponse } from '#shared/types'

const MONTH_PATTERN = /^\d{4}-\d{2}$/

export default defineEventHandler(async (event): Promise<LedgerResponse> => {
  const user = requireUser(event)
  const query = getQuery(event).month
  const month = typeof query === 'string' && MONTH_PATTERN.test(query) ? query : kstToday().slice(0, 7)
  const range = { $gte: `${month}-01`, $lte: `${month}-31` }

  const { hunts, bossClears, itemLogs } = await useCollections()
  const [huntDocs, clearDocs, items] = await Promise.all([
    hunts.find({ userId: user._id, date: range }).sort({ date: 1, createdAt: 1 }).toArray(),
    bossClears.find({ userId: user._id, date: range }).sort({ date: 1 }).toArray(),
    // 구매·강화 비용이 늘면 지출, 판매가가 늘면 수입. 잘못 적었다가 줄인 것도 그날 합계에서 빠진다
    itemLogs.aggregate<ItemFlow & { _id: string }>([
      { $match: { userId: user._id, date: range, excluded: { $ne: true } } },
      {
        $group: {
          _id: '$date',
          spent: { $sum: { $cond: [{ $eq: ['$field', 'sell'] }, 0, '$delta'] } },
          earned: { $sum: { $cond: [{ $eq: ['$field', 'sell'] }, '$delta', 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]).toArray(),
  ])
  return {
    month,
    hunts: huntDocs.map(toHuntEntry),
    clears: clearDocs.map(toBossClear),
    items: items.map(i => ({ date: i._id, spent: i.spent, earned: i.earned })),
  }
})
