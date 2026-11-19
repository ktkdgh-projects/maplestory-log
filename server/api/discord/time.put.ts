import { PARTY_SLOT_COUNT, PARTY_SLOTS_PER_DAY } from '#shared/data/party'
import { botRateLimit, useBotCollections } from '../../utils/discord/db'
import { partyTime } from '../../utils/discord/time'
import { partyOfBotUser } from '../../utils/discord/webAuth'
import { partyEntryWeek } from '../../utils/discord/week'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ p?: unknown, slots?: unknown }>(event)
  const { party, userId } = await partyOfBotUser(event, body?.p)
  await botRateLimit('time-put', userId, 60, 60)

  const { week, fromDay } = await partyEntryWeek(party)
  const { availability, weeks } = await useBotCollections()
  const weekDoc = await weeks.findOne({ partyId: party._id, week }, { projection: { phase: 1 } })
  if (weekDoc && weekDoc.phase !== 'collect') throw createError({ statusCode: 409, message: '마감됐어요. 투표가 시작돼서 더는 고칠 수 없어요.' })

  const slots = body?.slots
  if (!Array.isArray(slots) || slots.length > PARTY_SLOT_COUNT || slots.some(s => !Number.isInteger(s) || s < fromDay * PARTY_SLOTS_PER_DAY || s >= PARTY_SLOT_COUNT)) {
    throw createError({ statusCode: 400, message: '시간을 다시 골라 주세요.' })
  }
  await availability.updateOne(
    { userId, week },
    { $set: { slots: [...new Set(slots as number[])].sort((a, b) => a - b), updatedAt: new Date() } },
    { upsert: true },
  )
  return partyTime(party, userId, week, fromDay)
})
