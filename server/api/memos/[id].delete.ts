export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const id = parseId(getRouterParam(event, 'id'))

  const { memos } = await useCollections()
  const { deletedCount } = await memos.deleteOne({ _id: id, userId: user._id })
  if (!deletedCount) throw createError({ statusCode: 404, message: '메모를 찾을 수 없어요.' })
  return { ok: true }
})
