export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const id = parseId(getRouterParam(event, 'id'))

  const { itemSheets, itemRows } = await useCollections()
  const { deletedCount } = await itemSheets.deleteOne({ _id: id, userId: user._id })
  if (!deletedCount) throw createError({ statusCode: 404, message: '시트를 찾을 수 없어요.' })
  await itemRows.deleteMany({ userId: user._id, sheetId: id })
  return { ok: true }
})
