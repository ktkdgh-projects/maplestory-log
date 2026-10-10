import type { PotentialDetail } from '#shared/types'

// 장비 하나의 윗잠(side=top) 또는 에디(side=additional) 기록을 등급 단계별·날짜별로 묶어 돌려준다
export default defineEventHandler(async (event): Promise<PotentialDetail> => {
  const user = requireUser(event)
  const query = getQuery(event)
  const item = typeof query.item === 'string' ? query.item.trim() : ''
  if (!item || item.length > 100) throw createError({ statusCode: 400, message: '장비 이름을 확인해 주세요.' })
  const level = Number(query.level) > 0 ? Number(query.level) : null
  const from = query.from ? parseDate(query.from) : null

  const character = await ownCharacter(user._id, getRouterParam(event, 'ocid'), () => getUserApiKey(user._id))
  return potentialDetail(user._id, character.name, item, level, from, query.side === 'additional')
})
