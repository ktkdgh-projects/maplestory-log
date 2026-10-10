import type { CharacterBrief } from '#shared/types'

// 고른 기간에 강화 기록이 있는 내 계정 캐릭터. 썬데이 결산 카드가 캐릭터마다 결산을 받으려고 쓴다
export default defineEventHandler(async (event): Promise<CharacterBrief[]> => {
  const user = requireUser(event)
  const query = getQuery(event)
  const from = parseDate(query.from)
  const to = query.to ? parseDate(query.to) : from
  if (to < from) throw createError({ statusCode: 400, message: '기간을 다시 골라 주세요.' })

  const { enhanceEvents } = await useCollections()
  const names = await enhanceEvents.distinct('character', { userId: user._id, at: { $gte: kstDayStart(from), $lt: kstDayStart(addDays(to, 1)) } })
  if (!names.length) return []
  const characters = await accountCharacters(user._id, () => getUserApiKey(user._id))
  return characters.filter(c => names.includes(c.name))
})
