import { MVP_DISCOUNTS } from '#shared/data/starforce'

// MVP 할인은 넥슨 기록에 없어 사용자가 고른 값을 강화 비용 계산에 쓴다
export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const { rate } = await readBody<{ rate?: unknown }>(event)
  if (!MVP_DISCOUNTS.some(d => d.rate === rate)) throw createError({ statusCode: 400, message: 'MVP 등급을 다시 골라 주세요.' })

  const { users } = await useCollections()
  const before = user.mvpDiscount ?? 0
  if (before === rate) return { ok: true }
  const now = new Date()
  // 이력이 없던 사용자는 지금까지 쓴 값을 처음부터의 구간으로 남긴다
  const history = user.mvpHistory?.length ? user.mvpHistory : [{ from: new Date(0), rate: before }]
  await users.updateOne({ _id: user._id }, { $set: { mvpDiscount: rate as number, mvpHistory: [...history, { from: now, rate: rate as number }] } })
  return { ok: true }
})
