export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const id = parseId(getRouterParam(event, 'id'))
  const input = parseHuntInput(await readBody(event))

  const { hunts } = await useCollections()
  const { matchedCount } = await hunts.updateOne({ _id: id, userId: user._id }, { $set: input })
  if (!matchedCount) throw createError({ statusCode: 404, message: '기록을 찾을 수 없어요.' })
  return { ok: true }
})
