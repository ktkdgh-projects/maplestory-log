export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const id = parseId(getRouterParam(event, 'id'))
  const { feeRate } = await loadLedgerSettings(user._id)
  const input = parseDropSale(await readBody(event), feeRate)

  const { dropSales } = await useCollections()
  const { matchedCount } = await dropSales.updateOne({ _id: id, userId: user._id }, { $set: input })
  if (!matchedCount) throw createError({ statusCode: 404, message: '기록을 찾을 수 없어요.' })
  return { ok: true }
})
