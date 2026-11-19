import type { PartyLeadAction } from '#shared/types'
import { readPartyLink } from '../../utils/discord/link'
import { botRateLimit } from '../../utils/discord/db'
import { leaderAct, leaderState } from '../../utils/discord/leader'
import { partyOfLink } from '../../utils/discord/time'
import { partyWeek } from '../../utils/discord/week'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ t?: unknown } & Partial<PartyLeadAction>>(event)
  const link = readPartyLink(body?.t)
  await botRateLimit('lead-post', link.userId, 30, 60)
  const party = await partyOfLink(link)
  if (party.leaderId !== link.userId) throw createError({ statusCode: 403, message: '파티장만 쓸 수 있어요.' })
  if (typeof body.action !== 'string') throw createError({ statusCode: 400, message: '없는 동작이에요.' })

  const { doc, note } = await leaderAct(party, await partyWeek(party._id, link.week), { action: body.action, step: body.step, slot: typeof body.slot === 'number' ? body.slot : undefined })
  return leaderState(party, doc, note)
})
