import { readPartyLink } from '../../utils/discord/link'
import { botRateLimit } from '../../utils/discord/db'
import { leaderState } from '../../utils/discord/leader'
import { partyOfLink } from '../../utils/discord/time'
import { partyWeek } from '../../utils/discord/week'

// 파티장 화면이 몇 초마다 불러서 투표 현황을 새로 받는다
export default defineEventHandler(async (event) => {
  const link = readPartyLink(getQuery(event).t)
  await botRateLimit('lead-get', link.userId, 120, 60)
  const party = await partyOfLink(link)
  if (party.leaderId !== link.userId) throw createError({ statusCode: 403, message: '파티장만 쓸 수 있어요.' })
  setHeader(event, 'cache-control', 'private, no-store')
  return leaderState(party, await partyWeek(party._id, link.week))
})
