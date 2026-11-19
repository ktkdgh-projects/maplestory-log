import { PARTY_SLOT_COUNT } from '#shared/data/party'
import { readPartyLink } from '../../utils/discord/link'
import { botRateLimit, useBotCollections } from '../../utils/discord/db'
import { partyOfLink, partyTime } from '../../utils/discord/time'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ t?: unknown, slots?: unknown }>(event)
  const link = readPartyLink(body?.t)
  await botRateLimit('time-put', link.userId, 60, 60)
  await partyOfLink(link)

  const slots = body?.slots
  if (!Array.isArray(slots) || slots.length > PARTY_SLOT_COUNT || slots.some(s => !Number.isInteger(s) || s < 0 || s >= PARTY_SLOT_COUNT)) {
    throw createError({ statusCode: 400, message: '시간을 다시 골라 주세요.' })
  }
  const { availability } = await useBotCollections()
  await availability.updateOne(
    { userId: link.userId, week: link.week },
    { $set: { slots: [...new Set(slots as number[])].sort((a, b) => a - b), updatedAt: new Date() } },
    { upsert: true },
  )
  return partyTime(link)
})
