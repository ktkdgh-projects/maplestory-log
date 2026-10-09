export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const ids = parseIdList((await readBody<{ sheetIds?: unknown }>(event))?.sheetIds)

  const { itemSheets } = await useCollections()
  await itemSheets.bulkWrite(ids.map((_id, order) => ({ updateOne: { filter: { _id, userId: user._id }, update: { $set: { order } } } })))
  return { ok: true }
})
