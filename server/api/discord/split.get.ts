import type { PartySplitInfo } from '#shared/types'
import { botRateLimit } from '../../utils/discord/db'
import { partyOfBotUser } from '../../utils/discord/webAuth'

export default defineEventHandler(async (event): Promise<PartySplitInfo> => {
  const { party, userId } = await partyOfBotUser(event, getQuery(event).p)
  await botRateLimit('split-get', userId, 60, 60)
  setHeader(event, 'cache-control', 'private, no-store')
  return { partyName: party.name, me: userId, members: party.members.map(m => ({ id: m.userId, character: m.character })) }
})
