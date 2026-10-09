export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const id = parseId(getRouterParam(event, 'id'))

  const { itemRows, itemLogs } = await useCollections()
  const { deletedCount } = await itemRows.deleteOne({ _id: id, userId: user._id })
  if (!deletedCount) throw createError({ statusCode: 404, message: '장비를 찾을 수 없어요.' })
  // 잘못 만든 줄을 지우는 경우가 대부분이라 가계부에 잡힌 금액도 같이 지운다
  await itemLogs.deleteMany({ userId: user._id, rowId: id })
  return { ok: true }
})
