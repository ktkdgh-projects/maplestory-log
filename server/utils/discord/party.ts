import type { H3Event } from 'h3'
import type { PartyDoc, PartyMember } from './db'
import { useBotCollections } from './db'
import { channelViewers, originalReplyId, pinDiscordMessage, unpinDiscordMessage } from './api'
import { botPageUrl } from './webAuth'

// 디스코드 응답·컴포넌트 번호 (https://discord.com/developers/docs/interactions/receiving-and-responding)
export const RESPONSE = { pong: 1, message: 4, deferredUpdate: 6, updateMessage: 7, modal: 9 } as const
export const PARTY_EPHEMERAL = 64
export const PARTY_COLOR = 0xF2851E
const CHARACTER_MAX = 12
const NOT_IN_CHANNEL = '서버 채널에서만 쓸 수 있어요.'
export const PARTY_NOT_MEMBER = '이 파티 명단에 없어요. 파티장에게 명단 새로고침을 부탁해 주세요.'

export const PARTY_CHARACTER = 'party:character'
export const PARTY_REFRESH = 'party:refresh'
// 예전 메시지에 남아 있는 버튼 id. 지금은 링크 버튼이라 새 메시지에는 쓰지 않는다
export const PARTY_OLD_PAGES = { 'time:open': 'time', 'split:open': 'split', 'lead:menu': 'lead' } as const

export interface DiscordInteraction {
  type: number
  // 응답한 뒤에도 15분 동안 이 답을 고치거나 덧붙일 때 쓴다
  application_id?: string
  token?: string
  guild_id?: string
  channel_id?: string
  member?: { user: { id: string } }
  // flags에 64가 있으면 누른 사람에게만 보이는 메시지
  message?: { id: string, flags?: number }
  data?: {
    name?: string
    custom_id?: string
    // 선택 메뉴에서 고른 값
    values?: string[]
    options?: { name: string, type: number, value?: string, options?: { name: string, value?: string }[] }[]
    components?: { components?: { custom_id: string, value: string }[], component?: { custom_id: string, value: string } }[]
  }
}

// 누른 사람에게만 보이는 답
export function partyNotice(content: string, components: unknown[] = []) {
  return { type: RESPONSE.message, data: { content, components, flags: PARTY_EPHEMERAL, allowed_mentions: { parse: [] } } }
}

// 버튼·명령을 누른 사람이 이 채널 파티의 파티원일 때만 파티를 돌려준다
export async function partyOfInteraction(interaction: DiscordInteraction) {
  const userId = interaction.member?.user.id
  const { parties } = await useBotCollections()
  const party = userId ? await parties.findOne({ channelId: interaction.channel_id, 'members.userId': userId }) : null
  return party && userId ? { party, userId } : null
}

export const partyCharacter = (party: PartyDoc, userId: string) => party.members.find(m => m.userId === userId)?.character ?? '?'

export const partyTag = (userId: string) => `<@${userId}>`

// 모달에서 적어 낸 글 칸 하나
export function partyModalText(interaction: DiscordInteraction, customId: string): string {
  const rows = interaction.data?.components ?? []
  return rows.flatMap(r => r.components ?? (r.component ? [r.component] : [])).find(c => c.custom_id === customId)?.value.trim() ?? ''
}

// 파티 채널에 걸어 두는 명단 메시지. 캐릭터를 바꾸거나 명단을 새로 받을 때마다 이 메시지를 고쳐 쓴다
function rosterMessage(party: PartyDoc, event: H3Event) {
  return {
    embeds: [{
      title: `${party.name} 파티`,
      description: party.members.map(m => `• <@${m.userId}> · ${m.character}${m.userId === party.leaderId ? ' 👑' : ''}`).join('\n') || '이 채널을 볼 수 있는 사람이 없어요.',
      color: PARTY_COLOR,
      footer: { text: `파티원 ${party.members.length}명 · 채널을 볼 수 있는 사람이 파티원이에요` },
    }],
    components: [{
      type: 1,
      components: [
        { type: 2, style: 5, label: '보스 시간 적기', url: botPageUrl('time', party._id, event) },
        { type: 2, style: 5, label: '분배금', url: botPageUrl('split', party._id, event) },
        { type: 2, style: 5, label: '파티장 화면', url: botPageUrl('lead', party._id, event) },
        { type: 2, style: 2, label: '내 캐릭터 이름', custom_id: PARTY_CHARACTER },
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

// 명단 메시지를 채널에 고정한다. 예전에 고정한 명단이 따로 있으면 고정을 푼다(메시지는 남긴다)
async function pinRoster(party: PartyDoc, messageId: string) {
  if (party.rosterMessageId === messageId) return
  try {
    await pinDiscordMessage(party.channelId, messageId)
    if (party.rosterMessageId) await unpinDiscordMessage(party.channelId, party.rosterMessageId).catch(() => {})
    const { parties } = await useBotCollections()
    await parties.updateOne({ _id: party._id }, { $set: { rosterMessageId: messageId } })
  }
  catch (error) {
    console.error('[leda] 명단 고정 실패(채널에서 봇에게 메시지 고정 권한이 있는지 확인)', String((error as Error)?.message ?? error))
  }
}

// 파티를 연결한 사람이 파티장이 된다
export async function connectParty(interaction: DiscordInteraction, event: H3Event) {
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
  // 답으로 올린 명단 메시지는 보낸 뒤에야 id를 알 수 있어서 뒤에서 고정한다
  event.waitUntil(originalReplyId(interaction).then(id => pinRoster(party!, id)).catch(() => {}))
  return { type: RESPONSE.message, data: rosterMessage(party!, event) }
}

export async function refreshParty(interaction: DiscordInteraction, event: H3Event) {
  if (!interaction.guild_id || !interaction.channel_id) return partyNotice(NOT_IN_CHANNEL)
  const { parties } = await useBotCollections()
  const party = await parties.findOne({ channelId: interaction.channel_id })
  if (!party) return partyNotice('이 채널은 아직 파티로 연결되지 않았어요.')
  const members = await syncedMembers(interaction.guild_id, interaction.channel_id, party.members)
  const updated = await parties.findOneAndUpdate({ _id: party._id }, { $set: { members, updatedAt: new Date() } }, { returnDocument: 'after' })
  // 예전에 올린 명단도 새로고침하면 고정된다
  if (interaction.message) event.waitUntil(pinRoster(updated!, interaction.message.id))
  return { type: RESPONSE.updateMessage, data: rosterMessage(updated!, event) }
}

export async function askPartyCharacter(interaction: DiscordInteraction) {
  const found = await partyOfInteraction(interaction)
  if (!found) return partyNotice(PARTY_NOT_MEMBER)
  return {
    type: RESPONSE.modal,
    data: {
      custom_id: PARTY_CHARACTER,
      title: '내 캐릭터 이름',
      components: [{
        type: 1,
        components: [{ type: 4, custom_id: 'character', label: '이 파티에서 쓰는 캐릭터 이름', style: 1, min_length: 2, max_length: CHARACTER_MAX, required: true, value: partyCharacter(found.party, found.userId) }],
      }],
    },
  }
}

export async function savePartyCharacter(interaction: DiscordInteraction, event: H3Event) {
  const character = partyModalText(interaction, 'character')
  if (!interaction.channel_id || !interaction.member) return partyNotice(NOT_IN_CHANNEL)
  if (!character || character.length > CHARACTER_MAX) return partyNotice('캐릭터 이름을 다시 적어 주세요.')

  const { parties } = await useBotCollections()
  const updated = await parties.findOneAndUpdate(
    { channelId: interaction.channel_id, 'members.userId': interaction.member.user.id },
    { $set: { 'members.$.character': character, updatedAt: new Date() } },
    { returnDocument: 'after' },
  )
  if (!updated) return partyNotice(PARTY_NOT_MEMBER)
  return { type: RESPONSE.updateMessage, data: rosterMessage(updated, event) }
}

// 예전 메시지의 버튼을 누르면 화면 링크를 알려 준다
export async function openOldPartyPage(interaction: DiscordInteraction, event: H3Event) {
  const found = await partyOfInteraction(interaction)
  if (!found) return partyNotice(PARTY_NOT_MEMBER)
  const page = PARTY_OLD_PAGES[interaction.data!.custom_id as keyof typeof PARTY_OLD_PAGES]
  return partyNotice('버튼이 바뀌었어요. 명단 새로고침을 누르면 바로 열리는 버튼으로 바뀌어요.', [{ type: 1, components: [{ type: 2, style: 5, label: '화면 열기', url: botPageUrl(page, found.party._id, event) }] }])
}
