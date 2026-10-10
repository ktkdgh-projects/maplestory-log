import { SUNDAY_STARFORCE_EFFECTS } from '#shared/data/starforce'

// 운영자가 그 주 썬데이의 스타포스 효과를 고른다. 공지가 이미지라 사람이 보고 체크한다
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
