import { botRateLimit } from '../../utils/discord/db'
import { partyTime } from '../../utils/discord/time'
import { partyOfBotUser } from '../../utils/discord/webAuth'
import { partyTargetWeek } from '../../utils/discord/week'

export default defineEventHandler(async (event) => {
  const { party, userId } = await partyOfBotUser(event, getQuery(event).p)
  await botRateLimit('time-get', userId, 120, 60)
  setHeader(event, 'cache-control', 'private, no-store')
  return partyTime(party, userId, partyTargetWeek())
})
