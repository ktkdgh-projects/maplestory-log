export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const id = parseId(getRouterParam(event, 'id'))

  const { itemSheets, itemRows, itemLogs } = await useCollections()
  const { deletedCount } = await itemSheets.deleteOne({ _id: id, userId: user._id })
  if (!deletedCount) throw createError({ statusCode: 404, message: '시트를 찾을 수 없어요.' })
  const rows = await itemRows.find({ userId: user._id, sheetId: id }, { projection: { _id: 1 } }).toArray()
  await itemLogs.deleteMany({ userId: user._id, rowId: { $in: rows.map(r => r._id) } })
  await itemRows.deleteMany({ userId: user._id, sheetId: id })
  return { ok: true }
})
