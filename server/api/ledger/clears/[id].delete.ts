export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const id = parseId(getRouterParam(event, 'id'))

  const { bossClears } = await useCollections()
  const { deletedCount } = await bossClears.deleteOne({ _id: id, userId: user._id })
  if (!deletedCount) throw createError({ statusCode: 404, message: '기록을 찾을 수 없어요.' })
  return { ok: true }
})
