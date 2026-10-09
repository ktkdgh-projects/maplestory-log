export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const sheetId = parseId(getRouterParam(event, 'id'))
  const ids = parseIdList((await readBody<{ rowIds?: unknown }>(event))?.rowIds)

  const { itemRows } = await useCollections()
  // 내 시트의 줄만 바뀌도록 userId·sheetId를 함께 건다
  await itemRows.bulkWrite(ids.map((_id, order) => ({ updateOne: { filter: { _id, userId: user._id, sheetId }, update: { $set: { order } } } })))
  return { ok: true }
})
