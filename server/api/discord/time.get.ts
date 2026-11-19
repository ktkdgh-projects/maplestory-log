import { readPartyLink } from '../../utils/discord/link'
import { botRateLimit } from '../../utils/discord/db'
import { partyTime } from '../../utils/discord/time'

export default defineEventHandler(async (event) => {
  const link = readPartyLink(getQuery(event).t)
  await botRateLimit('time-get', link.userId, 120, 60)
  setHeader(event, 'cache-control', 'private, no-store')
  return partyTime(link)
})
