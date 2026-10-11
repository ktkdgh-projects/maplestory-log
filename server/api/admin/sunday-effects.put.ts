import { SUNDAY_STARFORCE_EFFECTS } from '#shared/data/starforce'

// 썬데이 공지는 이미지뿐이라 운영자가 보고 효과를 직접 고른다
export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const { id, effects } = await readBody<{ id?: unknown, effects?: unknown }>(event)
  const keys = new Set<string>(SUNDAY_STARFORCE_EFFECTS.map(e => e.key))
  if (typeof id !== 'number' || !Array.isArray(effects) || !effects.every(e => typeof e === 'string' && keys.has(e))) {
    throw createError({ statusCode: 400, message: '썬데이와 효과를 다시 골라 주세요.' })
  }
  const { sundays } = await useCollections()
  const { matchedCount } = await sundays.updateOne({ _id: id }, { $set: { effects: [...new Set(effects as string[])] } })
  if (!matchedCount) throw createError({ statusCode: 404, message: '그 썬데이 공지를 찾지 못했어요.' })
  return { ok: true }
})
