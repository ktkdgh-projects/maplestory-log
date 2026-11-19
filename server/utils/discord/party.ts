import type { PartyDoc, PartyMember } from './db'
import { useBotCollections } from './db'
import { channelViewers } from './api'

// 디스코드 응답·컴포넌트 번호 (https://discord.com/developers/docs/interactions/receiving-and-responding)
export const RESPONSE = { pong: 1, message: 4, updateMessage: 7, modal: 9 } as const
const EPHEMERAL = 64
const BRAND_COLOR = 0xF2851E
const CHARACTER_MAX = 12
const NOT_IN_CHANNEL = '서버 채널에서만 쓸 수 있어요.'
const NOT_MEMBER = '이 파티 명단에 없어요. 파티장에게 명단 새로고침을 부탁해 주세요.'

export const PARTY_CHARACTER = 'party:character'
export const PARTY_REFRESH = 'party:refresh'

export interface DiscordInteraction {
  type: number
  guild_id?: string
  channel_id?: string
  member?: { user: { id: string } }
  data?: {
    name?: string
    custom_id?: string
    options?: { name: string, type: number, value?: string, options?: { name: string, value?: string }[] }[]
    components?: { components?: { custom_id: string, value: string }[], component?: { custom_id: string, value: string } }[]
  }
}

export function partyNotice(content: string) {
  return { type: RESPONSE.message, data: { content, flags: EPHEMERAL, allowed_mentions: { parse: [] } } }
}

// 파티 채널에 걸어 두는 명단 메시지. 캐릭터를 바꾸거나 명단을 새로 받을 때마다 이 메시지를 고쳐 쓴다
function rosterMessage(party: PartyDoc) {
  return {
    embeds: [{
      title: `${party.name} 파티`,
      description: party.members.map(m => `• <@${m.userId}> · ${m.character}`).join('\n') || '이 채널을 볼 수 있는 사람이 없어요.',
      color: BRAND_COLOR,
      footer: { text: `파티원 ${party.members.length}명 · 채널을 볼 수 있는 사람이 파티원이에요` },
    }],
    components: [{
      type: 1,
      components: [
        { type: 2, style: 1, label: '내 캐릭터 이름', custom_id: PARTY_CHARACTER },
        { type: 2, style: 2, label: '명단 새로고침', custom_id: PARTY_REFRESH },
      ],
    }],
    allowed_mentions: { parse: [] },
  }
}

// 채널 권한으로 명단을 다시 만든다. 남아 있는 사람은 적어 둔 캐릭터 이름을 그대로 쓰고, 새로 온 사람은 서버 닉네임으로 시작한다
async function syncedMembers(guildId: string, channelId: string, current: PartyMember[]): Promise<PartyMember[]> {
  const viewers = await channelViewers(guildId, channelId)
  const now = new Date()
  return viewers.map(v => current.find(m => m.userId === v.userId) ?? { userId: v.userId, character: v.displayName.slice(0, CHARACTER_MAX), joinedAt: now })
}

export async function connectParty(interaction: DiscordInteraction) {
  const name = interaction.data?.options?.[0]?.options?.find(o => o.name === '이름')?.value?.trim()
  if (!interaction.guild_id || !interaction.channel_id || !interaction.member) return partyNotice(NOT_IN_CHANNEL)
  if (!name) return partyNotice('파티 이름을 적어 주세요.')

  const { parties } = await useBotCollections()
  const before = await parties.findOne({ channelId: interaction.channel_id })
  const members = await syncedMembers(interaction.guild_id, interaction.channel_id, before?.members ?? [])
  const now = new Date()
  const party = await parties.findOneAndUpdate(
    { channelId: interaction.channel_id },
    {
      $set: { guildId: interaction.guild_id, name, leaderId: interaction.member.user.id, members, updatedAt: now },
      $setOnInsert: { channelId: interaction.channel_id, createdAt: now },
    },
    { upsert: true, returnDocument: 'after' },
  )
  return { type: RESPONSE.message, data: rosterMessage(party!) }
}

export async function refreshParty(interaction: DiscordInteraction) {
  if (!interaction.guild_id || !interaction.channel_id) return partyNotice(NOT_IN_CHANNEL)
  const { parties } = await useBotCollections()
  const party = await parties.findOne({ channelId: interaction.channel_id })
  if (!party) return partyNotice('이 채널은 아직 파티로 연결되지 않았어요.')
  const members = await syncedMembers(interaction.guild_id, interaction.channel_id, party.members)
  const updated = await parties.findOneAndUpdate({ _id: party._id }, { $set: { members, updatedAt: new Date() } }, { returnDocument: 'after' })
  return { type: RESPONSE.updateMessage, data: rosterMessage(updated!) }
}

export async function askPartyCharacter(interaction: DiscordInteraction) {
  const { parties } = await useBotCollections()
  const party = await parties.findOne({ channelId: interaction.channel_id })
  const mine = party?.members.find(m => m.userId === interaction.member?.user.id)
  if (!mine) return partyNotice(NOT_MEMBER)
  return {
    type: RESPONSE.modal,
    data: {
      custom_id: PARTY_CHARACTER,
      title: '내 캐릭터 이름',
      components: [{
        type: 1,
        components: [{ type: 4, custom_id: 'character', label: '이 파티에서 쓰는 캐릭터 이름', style: 1, min_length: 2, max_length: CHARACTER_MAX, required: true, value: mine.character }],
      }],
    },
  }
}

function submittedCharacter(interaction: DiscordInteraction) {
  const rows = interaction.data?.components ?? []
  const field = rows.flatMap(r => r.components ?? (r.component ? [r.component] : [])).find(c => c.custom_id === 'character')
  return field?.value.trim() ?? ''
}

export async function savePartyCharacter(interaction: DiscordInteraction) {
  const character = submittedCharacter(interaction)
  if (!interaction.channel_id || !interaction.member) return partyNotice(NOT_IN_CHANNEL)
  if (!character || character.length > CHARACTER_MAX) return partyNotice('캐릭터 이름을 다시 적어 주세요.')

  const { parties } = await useBotCollections()
  const updated = await parties.findOneAndUpdate(
    { channelId: interaction.channel_id, 'members.userId': interaction.member.user.id },
    { $set: { 'members.$.character': character, updatedAt: new Date() } },
    { returnDocument: 'after' },
  )
  if (!updated) return partyNotice(NOT_MEMBER)
  return { type: RESPONSE.updateMessage, data: rosterMessage(updated) }
}
