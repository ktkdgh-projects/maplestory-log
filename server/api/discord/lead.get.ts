import { botRateLimit } from '../../utils/discord/db'
import { leaderState, requirePartyLeader } from '../../utils/discord/leader'
import { partyCycleWeek, partyWeek } from '../../utils/discord/week'

// 파티장 화면이 몇 초마다 불러서 투표 현황을 새로 받는다
export default defineEventHandler(async (event) => {
  const { party, userId } = await requirePartyLeader(event, getQuery(event).p)
  await botRateLimit('lead-get', userId, 120, 60)
  setHeader(event, 'cache-control', 'private, no-store')
  return leaderState(party, await partyWeek(party._id, partyCycleWeek()))
})
