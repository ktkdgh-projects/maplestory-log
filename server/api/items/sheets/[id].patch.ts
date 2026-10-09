export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const id = parseId(getRouterParam(event, 'id'))
  const body = await readBody<{ title?: unknown, folded?: unknown, excluded?: unknown }>(event)

  const update: { title?: string, folded?: boolean, excluded?: boolean } = {}
  if (body?.title !== undefined) update.title = parseText(body.title, '시트 이름')
  if (typeof body?.folded === 'boolean') update.folded = body.folded
  if (typeof body?.excluded === 'boolean') update.excluded = body.excluded

  const { itemSheets } = await useCollections()
  const { matchedCount } = await itemSheets.updateOne({ _id: id, userId: user._id }, { $set: update })
  if (!matchedCount) throw createError({ statusCode: 404, message: '시트를 찾을 수 없어요.' })
  return { ok: true }
})
