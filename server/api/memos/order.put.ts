export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const ids = parseIdList((await readBody<{ ids?: unknown }>(event))?.ids)

  const { memos } = await useCollections()
  await memos.bulkWrite(ids.map((_id, order) => ({ updateOne: { filter: { _id, userId: user._id }, update: { $set: { order } } } })))
  return { ok: true }
})
