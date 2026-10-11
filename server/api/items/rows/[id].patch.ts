import type { ItemRowDoc } from '../../../utils/mongo'
import { effectiveFee } from '#shared/calc/meso'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const id = parseId(getRouterParam(event, 'id'))
  const body = await readBody<Record<string, unknown>>(event)

  const { itemRows } = await useCollections()
  const row = await itemRows.findOne({ _id: id, userId: user._id })
  if (!row) throw createError({ statusCode: 404, message: '장비를 찾을 수 없어요.' })

  const today = kstToday()
  const update: Partial<ItemRowDoc> = {}
  if (body?.part !== undefined) update.part = parseText(body.part, '부위', false)
  if (body?.name !== undefined) update.name = parseText(body.name, '장비 이름')
  if (body?.memo !== undefined) update.memo = parseText(body.memo, '메모', false) || null
  if (body?.buy !== undefined) update.buy = parseMeso(body.buy, '구매가')
  if (body?.starforce !== undefined) update.starforce = parseMeso(body.starforce, '스타포스 비용')
  if (body?.potential !== undefined) update.potential = parseMeso(body.potential, '잠재 비용')
  if (body?.sell !== undefined) update.sell = parseMeso(body.sell, '판매가')
  for (const key of ['buyDate', 'starforceDate', 'potentialDate', 'sellDate'] as const) {
    if (body?.[key] !== undefined) update[key] = body[key] ? parseDate(body[key]) : null
  }
  if (typeof body?.excluded === 'boolean') update.excluded = body.excluded
  // 여러 번 나눠 산 줄은 내역이 기준이고, 구매가·구매일은 그 합계·가장 이른 날로 맞춘다
  if (body?.purchases !== undefined) {
    update.purchases = parsePurchases(body.purchases)
    update.buy = update.purchases.reduce((sum, p) => sum + p.amount, 0)
    update.buyDate = update.purchases[0]?.date ?? null
  }
  // 강화 비용을 날짜별로 나눠 적은 줄은 내역이 기준이고, 금액·날짜는 그 합계·가장 늦은 날로 맞춘다
  for (const [entries, total, date] of [['starforceEntries', 'starforce', 'starforceDate'], ['potentialEntries', 'potential', 'potentialDate']] as const) {
    if (body?.[entries] === undefined) continue
    update[entries] = parsePurchases(body[entries])
    update[total] = update[entries]!.reduce((sum, p) => sum + p.amount, 0)
    update[date] = update[entries]!.at(-1)?.date ?? null
  }
  if (body?.sellFee !== undefined) {
    if (!isAuctionFee(body.sellFee)) throw createError({ statusCode: 400, message: '수수료를 골라 주세요.' })
    update.sellFee = body.sellFee
  }
  // 판매가를 처음 적을 때 MVP 실버 이상이면 수수료를 3%로 정해 둔다. 나중에 등급이 바뀌어도 이 값은 그대로다
  if (update.sell && !row.sell && update.sellFee === undefined) update.sellFee = effectiveFee(row.sellFee, user.mvpDiscount)
  // 날짜를 안 고르고 금액만 적으면 오늘 날짜로 가계부에 넣는다
  if (update.buy && !(update.buyDate ?? row.buyDate)) update.buyDate = today
  if (update.starforce && !(update.starforceDate ?? row.starforceDate)) update.starforceDate = today
  if (update.potential && !(update.potentialDate ?? row.potentialDate)) update.potentialDate = today
  if (update.sell && !(update.sellDate ?? row.sellDate)) update.sellDate = today

  await itemRows.updateOne({ _id: id, userId: user._id }, { $set: update })
  if (update.sellFee !== undefined) await rememberFeeRate(user._id, update.sellFee)
  return { ok: true }
})
