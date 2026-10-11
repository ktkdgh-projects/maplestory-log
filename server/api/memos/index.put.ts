export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const list = (await readBody<{ memos?: unknown }>(event))?.memos
  if (!Array.isArray(list) || !list.length || list.length > MAX_MEMOS) throw createError({ statusCode: 400, message: '저장할 메모가 올바르지 않아요.' })
  const changes = list.map((raw: { id?: unknown, title?: unknown, body?: unknown }) => ({ _id: parseId(typeof raw?.id === 'string' ? raw.id : undefined), ...parseMemo(raw) }))

  const { memos } = await useCollections()
  const updatedAt = new Date()
  await memos.bulkWrite(changes.map(({ _id, ...set }) => ({ updateOne: { filter: { _id, userId: user._id }, update: { $set: { ...set, updatedAt } } } })), { ordered: false })
  return { updatedAt: updatedAt.toISOString() }
})
