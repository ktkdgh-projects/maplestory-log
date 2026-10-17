// 내 정보 '내 권리'에 보여 줄 내 기록 개수
export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const userId = user._id
  const { hunts, dropSales, bossClears, itemRows, mesoEntries, memos, enhanceEvents } = await useCollections()
  const [hunt, sale, boss, item, entry, memo, enhance] = await Promise.all([hunts, dropSales, bossClears, itemRows, mesoEntries, memos, enhanceEvents].map(c => (c as typeof hunts).countDocuments({ userId })))
  return { hunt, sale, boss, item, entry, memo, enhance }
})
