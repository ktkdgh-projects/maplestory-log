import type { PartyTimeResponse } from '#shared/types'
import type { PartyDoc } from './db'
import { useBotCollections } from './db'

// 다른 파티원은 냈는지만 알려 주고, 언제 되는지는 본인 것만 돌려준다
export async function partyTime(party: PartyDoc, userId: string, week: string, fromDay: number): Promise<PartyTimeResponse> {
  const { availability, weeks } = await useBotCollections()
  const [docs, last, weekDoc] = await Promise.all([
    availability.find({ userId: { $in: party.members.map(m => m.userId) }, week }).toArray(),
    availability.findOne({ userId, week: addDays(week, -7) }),
    weeks.findOne({ partyId: party._id, week }, { projection: { phase: 1 } }),
  ])
  const byUser = new Map(docs.map(d => [d.userId, d]))
  return {
    week,
    fromDay,
    partyName: party.name,
    slots: byUser.get(userId)?.slots ?? [],
    saved: byUser.has(userId),
    lastWeekSlots: last?.slots ?? [],
    closed: !!weekDoc && weekDoc.phase !== 'collect',
    leader: party.leaderId === userId,
    members: party.members.map(m => ({ character: m.character, me: m.userId === userId, submitted: byUser.has(m.userId) })),
  }
}
