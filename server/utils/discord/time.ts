import { ObjectId } from 'mongodb'
import type { H3Event } from 'h3'
import type { PartyTimeResponse } from '#shared/types'
import { useBotCollections } from './db'
import { signPartyLink, type PartyLink } from './link'
import { PARTY_NOT_MEMBER, partyNotice, partyOfInteraction, type DiscordInteraction } from './party'
import { partyTargetWeek } from './week'

// 버튼을 누른 사람에게만 보이는 개인 링크를 준다
export async function openPartyTime(event: H3Event, interaction: DiscordInteraction) {
  const found = await partyOfInteraction(interaction)
  if (!found) return partyNotice(PARTY_NOT_MEMBER)

  const token = signPartyLink({ userId: found.userId, partyId: found.party._id.toHexString(), week: partyTargetWeek() })
  const { origin } = getRequestURL(event, { xForwardedHost: true, xForwardedProto: true })
  return partyNotice('나만 쓰는 링크예요. 시간표에서 되는 시간을 칠하고 제출해 주세요.', [{ type: 1, components: [{ type: 2, style: 5, label: '시간표 열기', url: `${origin}/party/time?t=${token}` }] }])
}

// 링크의 사람이 지금도 그 파티원인지 DB로 다시 확인한다
export async function partyOfLink(link: PartyLink) {
  const { parties } = await useBotCollections()
  const party = ObjectId.isValid(link.partyId) ? await parties.findOne({ _id: new ObjectId(link.partyId), 'members.userId': link.userId }) : null
  if (!party) throw createError({ statusCode: 403, message: '이 파티 명단에 없어요.' })
  return party
}

// 다른 파티원은 냈는지만 알려 주고, 언제 되는지는 본인 것만 돌려준다
export async function partyTime(link: PartyLink): Promise<PartyTimeResponse> {
  const party = await partyOfLink(link)
  const { availability, weeks } = await useBotCollections()
  const [docs, last, week] = await Promise.all([
    availability.find({ userId: { $in: party.members.map(m => m.userId) }, week: link.week }).toArray(),
    availability.findOne({ userId: link.userId, week: addDays(link.week, -7) }),
    weeks.findOne({ partyId: party._id, week: link.week }, { projection: { phase: 1 } }),
  ])
  const byUser = new Map(docs.map(d => [d.userId, d]))
  return {
    week: link.week,
    partyName: party.name,
    slots: byUser.get(link.userId)?.slots ?? [],
    saved: byUser.has(link.userId),
    lastWeekSlots: last?.slots ?? [],
    closed: !!week && week.phase !== 'collect',
    leader: party.leaderId === link.userId,
    members: party.members.map(m => ({ character: m.character, me: m.userId === link.userId, submitted: byUser.has(m.userId) })),
  }
}
