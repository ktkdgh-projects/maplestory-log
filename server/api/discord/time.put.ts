import { PARTY_SLOT_COUNT } from '#shared/data/party'
import { readPartyLink } from '../../utils/discord/link'
import { botRateLimit, useBotCollections } from '../../utils/discord/db'
import { partyOfLink, partyTime } from '../../utils/discord/time'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ t?: unknown, slots?: unknown }>(event)
  const link = readPartyLink(body?.t)
  await botRateLimit('time-put', link.userId, 60, 60)
  const party = await partyOfLink(link)
  const { availability, weeks } = await useBotCollections()
  const week = await weeks.findOne({ partyId: party._id, week: link.week }, { projection: { phase: 1 } })
  if (week && week.phase !== 'collect') throw createError({ statusCode: 409, message: '마감됐어요. 투표가 시작돼서 더는 고칠 수 없어요.' })

  const slots = body?.slots
  if (!Array.isArray(slots) || slots.length > PARTY_SLOT_COUNT || slots.some(s => !Number.isInteger(s) || s < 0 || s >= PARTY_SLOT_COUNT)) {
    throw createError({ statusCode: 400, message: '시간을 다시 골라 주세요.' })
  }
  await availability.updateOne(
    { userId: link.userId, week: link.week },
    { $set: { slots: [...new Set(slots as number[])].sort((a, b) => a - b), updatedAt: new Date() } },
    { upsert: true },
  )
  return partyTime(link)
})
