import type { PartyLeadAction } from '#shared/types'
import { botRateLimit } from '../../utils/discord/db'
import { leaderAct, leaderState, requirePartyLeader } from '../../utils/discord/leader'
import { partyCycleWeek, partyWeek } from '../../utils/discord/week'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ p?: unknown } & Partial<PartyLeadAction>>(event)
  const { party, userId } = await requirePartyLeader(event, body?.p)
  await botRateLimit('lead-post', userId, 30, 60)
  if (body.action !== 'run' && body.action !== 'pick') throw createError({ statusCode: 400, message: '없는 동작이에요.' })

  const { doc, note } = await leaderAct(party, await partyWeek(party._id, partyCycleWeek()), { action: body.action, step: body.step, slot: typeof body.slot === 'number' ? body.slot : undefined })
  return leaderState(party, doc, note)
})
