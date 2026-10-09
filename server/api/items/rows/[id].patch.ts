import type { ItemLogDoc } from '../../../utils/mongo'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const id = parseId(getRouterParam(event, 'id'))
  const body = await readBody<Record<string, unknown>>(event)

  const { itemSheets, itemRows, itemLogs } = await useCollections()
  const row = await itemRows.findOne({ _id: id, userId: user._id })
  if (!row) throw createError({ statusCode: 404, message: '장비를 찾을 수 없어요.' })

  const update: Partial<typeof row> = {}
  if (body?.part !== undefined) update.part = parseText(body.part, '부위', false)
  if (body?.name !== undefined) update.name = parseText(body.name, '장비 이름')
  if (body?.memo !== undefined) update.memo = parseText(body.memo, '메모', false) || null
  if (body?.buy !== undefined) update.buy = parseMeso(body.buy, '구매가')
  if (body?.cost !== undefined) update.cost = parseMeso(body.cost, '강화 비용')
  if (body?.sell !== undefined) update.sell = parseMeso(body.sell, '판매가')
  if (body?.sellFee !== undefined) {
    if (!isAuctionFee(body.sellFee)) throw createError({ statusCode: 400, message: '수수료를 골라 주세요.' })
    update.sellFee = body.sellFee
  }

  // 가계부에는 바뀐 만큼만 그날 날짜로 남긴다. 판매는 수수료를 뗀 받은 메소 기준이라 수수료만 바꿔도 차이가 남는다
  const excluded = (await itemSheets.findOne({ _id: row.sheetId }, { projection: { excluded: 1 } }))?.excluded ?? false
  const before = { buy: row.buy, cost: row.cost, sell: afterFee(row.sell, row.sellFee ?? DEFAULT_AUCTION_FEE) }
  const after = { buy: update.buy ?? row.buy, cost: update.cost ?? row.cost, sell: afterFee(update.sell ?? row.sell, update.sellFee ?? row.sellFee ?? DEFAULT_AUCTION_FEE) }
  const date = kstToday()
  const logs: ItemLogDoc[] = (['buy', 'cost', 'sell'] as const)
    .filter(field => after[field] !== before[field])
    .map(field => ({ userId: user._id, rowId: id, date, field, delta: after[field] - before[field], excluded, at: new Date() }))

  await itemRows.updateOne({ _id: id }, { $set: update })
  if (logs.length) await itemLogs.insertMany(logs)
  if (update.sellFee !== undefined) await rememberFeeRate(user._id, update.sellFee)
  return { ok: true }
})
