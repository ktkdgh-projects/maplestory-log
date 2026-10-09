export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const id = parseId(getRouterParam(event, 'id'))
  const body = await readBody<{ loot?: unknown }>(event)

  const { bossClears } = await useCollections()
  const { feeRate } = await loadLedgerSettings(user._id)
  const loot = parseLoot(body?.loot, feeRate)
  const { matchedCount } = await bossClears.updateOne({ _id: id, userId: user._id }, { $set: { loot } })
  if (!matchedCount) throw createError({ statusCode: 404, message: '기록을 찾을 수 없어요.' })

  const lastSold = loot.findLast(l => l.price)
  if (lastSold && lastSold.fee !== feeRate) await rememberFeeRate(user._id, lastSold.fee)
  return { ok: true }
})
