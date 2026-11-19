import { ObjectId } from 'mongodb'
import type { H3Event } from 'h3'
import { bossPeriod } from '#shared/data/bosses'
import type { PartyTimeResponse } from '#shared/types'
import { PARTY_SLOT_COUNT } from '#shared/data/party'
import { useBotCollections } from './db'
import { signPartyLink, type PartyLink } from './link'
import { PARTY_NOT_MEMBER, partyNotice, type DiscordInteraction } from './party'

// 시간을 모으는 주: 다음 목요일부터 일주일
function targetWeek(): string {
  return addDays(bossPeriod('weekly', kstToday()), 7)
}

// 버튼을 누른 사람에게만 보이는 개인 링크를 준다
export async function openPartyTime(event: H3Event, interaction: DiscordInteraction) {
  const { parties } = await useBotCollections()
  const party = await parties.findOne({ channelId: interaction.channel_id })
  const userId = interaction.member?.user.id
  if (!party || !userId || !party.members.some(m => m.userId === userId)) return partyNotice(PARTY_NOT_MEMBER)

  const token = signPartyLink({ userId, partyId: party._id.toHexString(), week: targetWeek() })
  const { origin } = getRequestURL(event, { xForwardedHost: true, xForwardedProto: true })
  return partyNotice('아래 버튼은 나만 쓰는 링크예요. 가능한 시간을 끌어서 칠해 주세요.', [{ type: 1, components: [{ type: 2, style: 5, label: '시간 적으러 가기', url: `${origin}/party/time?t=${token}` }] }])
}

// 링크의 사람이 지금도 그 파티원인지 DB로 다시 확인한다
export async function partyOfLink(link: PartyLink) {
  const { parties } = await useBotCollections()
  const party = ObjectId.isValid(link.partyId) ? await parties.findOne({ _id: new ObjectId(link.partyId), 'members.userId': link.userId }) : null
  if (!party) throw createError({ statusCode: 403, message: '이 파티 명단에 없어요.' })
  return party
}

export async function partyTime(link: PartyLink): Promise<PartyTimeResponse> {
  const party = await partyOfLink(link)
  const { availability } = await useBotCollections()
  const [docs, last] = await Promise.all([
    availability.find({ userId: { $in: party.members.map(m => m.userId) }, week: link.week }).toArray(),
    availability.findOne({ userId: link.userId, week: addDays(link.week, -7) }),
  ])
  const byUser = new Map(docs.map(d => [d.userId, d]))
  const others = docs.filter(d => d.userId !== link.userId)
  const othersCounts = Array.from({ length: PARTY_SLOT_COUNT }, () => 0)
  for (const doc of others) for (const slot of doc.slots) othersCounts[slot]!++
  return {
    week: link.week,
    partyName: party.name,
    slots: byUser.get(link.userId)?.slots ?? [],
    saved: byUser.has(link.userId),
    lastWeekSlots: last?.slots ?? [],
    othersCounts,
    othersSubmitted: others.length,
    members: party.members.map(m => ({ character: m.character, me: m.userId === link.userId, submitted: byUser.has(m.userId) })),
  }
}
