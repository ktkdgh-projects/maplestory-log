import type { PartySplitInfo } from '#shared/types'
import { readPartyLink } from '../../utils/discord/link'
import { botRateLimit } from '../../utils/discord/db'
import { partyOfLink } from '../../utils/discord/time'

export default defineEventHandler(async (event): Promise<PartySplitInfo> => {
  const link = readPartyLink(getQuery(event).t)
  await botRateLimit('split-get', link.userId, 60, 60)
  const party = await partyOfLink(link)
  setHeader(event, 'cache-control', 'private, no-store')
  return { partyName: party.name, me: link.userId, members: party.members.map(m => ({ id: m.userId, character: m.character })) }
})
