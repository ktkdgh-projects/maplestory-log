import { DEFAULT_AUCTION_FEE } from '#shared/data/auction'

// 수수료 기본값은 판매할 때 고른 값으로 자동 기억되므로 여기서는 보유 메소 맞추기만 받는다
export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const body = await readBody<{ balance?: { date?: unknown, amount?: unknown } | null }>(event)

  let update: { balanceDate: string | null, balance: number | null } = { balanceDate: null, balance: null }
  if (body?.balance) {
    const amount = Number(body.balance.amount)
    if (!Number.isSafeInteger(amount) || amount < 0 || amount > MESO_MAX) throw createError({ statusCode: 400, message: '보유 메소를 0 이상의 숫자로 적어 주세요.' })
    update = { balanceDate: parseDate(body.balance.date), balance: amount }
  }
  else if (body?.balance !== null) throw createError({ statusCode: 400, message: '보유 메소를 적어 주세요.' })

  const { ledgerSettings } = await useCollections()
  await ledgerSettings.updateOne(
    { _id: user._id },
    { $set: { ...update, updatedAt: new Date() }, $setOnInsert: { feeRate: DEFAULT_AUCTION_FEE } },
    { upsert: true },
  )
  return { ok: true }
})
