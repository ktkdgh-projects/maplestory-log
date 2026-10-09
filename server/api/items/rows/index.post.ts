import { ObjectId } from 'mongodb'

const MAX_ROWS = 60

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const body = await readBody<{ sheetId?: unknown, part?: unknown, name?: unknown }>(event)
  const sheetId = parseId(typeof body?.sheetId === 'string' ? body.sheetId : undefined)

  const { itemSheets, itemRows } = await useCollections()
  if (!(await itemSheets.countDocuments({ _id: sheetId, userId: user._id }))) throw createError({ statusCode: 404, message: '시트를 찾을 수 없어요.' })
  const count = await itemRows.countDocuments({ userId: user._id, sheetId })
  if (count >= MAX_ROWS) throw createError({ statusCode: 409, message: `한 시트에 ${MAX_ROWS}줄까지 넣을 수 있어요.` })

  const _id = new ObjectId()
  await itemRows.insertOne({
    _id,
    userId: user._id,
    sheetId,
    part: parseText(body?.part, '부위', false),
    name: parseText(body?.name, '장비 이름'),
    icon: null,
    buy: 0,
    cost: 0,
    sell: 0,
    sellFee: (await loadLedgerSettings(user._id)).feeRate,
    memo: null,
    order: count,
  })
  return { id: _id.toHexString() }
})
