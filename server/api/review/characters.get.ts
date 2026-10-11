import type { CharacterBrief } from '#shared/types'

export default defineEventHandler(async (event): Promise<CharacterBrief[]> => {
  const user = requireUser(event)
  const query = getQuery(event)
  if (!query.from) throw createError({ statusCode: 400, message: '기간을 다시 골라 주세요.' })
  const { from, to } = parseReviewRange(query)

  const { enhanceEvents } = await useCollections()
  const names = await enhanceEvents.distinct('character', { userId: user._id, at: { $gte: kstDayStart(from), $lt: kstDayStart(addDays(to, 1)) } })
  if (!names.length) return []
  const characters = await accountCharacters(user._id, () => getUserApiKey(user._id))
  return characters.filter(c => names.includes(c.name))
})
