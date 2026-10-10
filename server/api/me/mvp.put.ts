import { MVP_DISCOUNTS } from '#shared/data/starforce'

// 스타포스 MVP 할인율. 넥슨 기록에 없어 사용자가 고른 값을 강화 비용 계산에 쓴다
export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const { rate } = await readBody<{ rate?: unknown }>(event)
  if (!MVP_DISCOUNTS.some(d => d.rate === rate)) throw createError({ statusCode: 400, message: 'MVP 등급을 다시 골라 주세요.' })

  const { users } = await useCollections()
  await users.updateOne({ _id: user._id }, { $set: { mvpDiscount: rate as number } })
  return { ok: true }
})
