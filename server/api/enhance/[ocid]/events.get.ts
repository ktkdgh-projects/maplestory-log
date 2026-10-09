import type { EnhanceEvent } from '#shared/types'

// 장비 하나의 강화 기록 목록. 고른 장비만 따로 받아 첫 화면 응답을 가볍게 한다
export default defineEventHandler(async (event): Promise<EnhanceEvent[]> => {
  const user = requireUser(event)
  const query = getQuery(event)
  const item = typeof query.item === 'string' ? query.item.trim() : ''
  if (!item || item.length > 100) throw createError({ statusCode: 400, message: '장비 이름을 확인해 주세요.' })
  const level = Number(query.level) > 0 ? Number(query.level) : null
  const from = query.from ? parseDate(query.from) : null

  const character = await ownCharacter(user._id, getRouterParam(event, 'ocid'), () => getUserApiKey(user._id))
  return itemEvents(user._id, character.name, item, level, from)
})
