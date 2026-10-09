export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const id = parseId(getRouterParam(event, 'id'))
  const body = await readBody<{ title?: unknown, folded?: unknown, excluded?: unknown }>(event)

  const update: { title?: string, folded?: boolean, excluded?: boolean } = {}
  if (body?.title !== undefined) update.title = parseText(body.title, '시트 이름')
  if (typeof body?.folded === 'boolean') update.folded = body.folded
  if (typeof body?.excluded === 'boolean') update.excluded = body.excluded

  const { itemSheets, itemRows, itemLogs } = await useCollections()
  const { matchedCount } = await itemSheets.updateOne({ _id: id, userId: user._id }, { $set: update })
  if (!matchedCount) throw createError({ statusCode: 404, message: '시트를 찾을 수 없어요.' })
  // 가계부 반영을 켜고 끄면 그 시트 줄들의 지난 기록도 같이 따라간다
  if (update.excluded !== undefined) {
    const rowIds = (await itemRows.find({ userId: user._id, sheetId: id }, { projection: { _id: 1 } }).toArray()).map(r => r._id)
    await itemLogs.updateMany({ userId: user._id, rowId: { $in: rowIds } }, { $set: { excluded: update.excluded } })
  }
  return { ok: true }
})
