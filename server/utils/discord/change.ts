import type { H3Event } from 'h3'
import type { PartyDoc, WeekDoc } from './db'
import { useBotCollections } from './db'
import { deleteDiscordReply } from './api'
import { PARTY_COLOR, PARTY_NOT_MEMBER, RESPONSE, partyCharacter, partyModalText, partyNotice, partyOfInteraction, partyTag, type DiscordInteraction } from './party'
import { clearPosts, noticeMessage, patchWeek, postWeek, slotLabel, slotStart, weekConflicts } from './week'

// 버튼·모달 id: chg:open:<주>, chg:sel:<주>, chg:reason:<주>:<칸.칸>, chg:submit:<주>:<칸.칸>, chg:ok:<주>:<칸>, chg:cancel:<주>
const REASON_MAX = 80

async function changeContext(interaction: DiscordInteraction) {
  const found = await partyOfInteraction(interaction)
  if (!found) return null
  const [, , week, extra] = interaction.data!.custom_id!.split(':')
  const { weeks } = await useBotCollections()
  const doc = await weeks.findOne({ partyId: found.party._id, week })
  return { ...found, doc, extra: extra ?? '' }
}

// 투표에 올랐던 후보에서 확정 시간, 지난 시간, 파티원의 다른 일정과 겹치는 시간을 뺀다
async function changeOptions(party: PartyDoc, doc: WeekDoc): Promise<number[]> {
  const conflicts = await weekConflicts(party, doc.week)
  const now = Date.now()
  return doc.candidates.map(c => c.slot).filter(slot => slot !== doc.confirmed && !conflicts.has(slot) && slotStart(doc.week, slot).getTime() > now)
}

function optionSelect(doc: WeekDoc, options: number[], picked: number[]) {
  return {
    type: 1,
    components: [{
      type: 3,
      custom_id: `chg:sel:${doc.week}`,
      placeholder: '바꾸고 싶은 시간 고르기',
      min_values: 1,
      max_values: options.length,
      options: options.map(slot => ({ label: slotLabel(doc.week, slot), value: String(slot), default: picked.includes(slot) })),
    }],
  }
}

export async function openPartyChange(interaction: DiscordInteraction) {
  const ctx = await changeContext(interaction)
  if (!ctx) return partyNotice(PARTY_NOT_MEMBER)
  if (!ctx.doc || ctx.doc.confirmed === null) return partyNotice('아직 확정된 보스 시간이 없어요.')
  if (ctx.doc.change) return partyNotice('이미 변경 요청이 진행 중이에요.')
  const options = await changeOptions(ctx.party, ctx.doc)
  if (!options.length) return partyNotice('바꿀 수 있는 다른 시간이 없어요.')
  return partyNotice(`지금 보스 시간은 **${slotLabel(ctx.doc.week, ctx.doc.confirmed)}**이에요. 되는 시간을 모두 골라 주세요.`, [optionSelect(ctx.doc, options, [])])
}

export async function pickPartyChange(interaction: DiscordInteraction) {
  const ctx = await changeContext(interaction)
  if (!ctx?.doc || ctx.doc.confirmed === null) return partyNotice(PARTY_NOT_MEMBER)
  const options = await changeOptions(ctx.party, ctx.doc)
  const picked = (interaction.data?.values ?? []).map(Number).filter(slot => options.includes(slot))
  if (!picked.length) return partyNotice('시간을 다시 골라 주세요.')
  return {
    type: RESPONSE.updateMessage,
    data: {
      content: `고른 시간: **${picked.map(slot => slotLabel(ctx.doc!.week, slot)).join(', ')}**\n아래 버튼으로 사유를 적으면 파티 채널에 요청이 올라가요.`,
      components: [
        optionSelect(ctx.doc, options, picked),
        { type: 1, components: [{ type: 2, style: 1, label: '사유 적고 요청 보내기', custom_id: `chg:reason:${ctx.doc.week}:${picked.join('.')}` }] },
      ],
    },
  }
}

export function askPartyChangeReason(interaction: DiscordInteraction) {
  const [, , week, slots] = interaction.data!.custom_id!.split(':')
  return {
    type: RESPONSE.modal,
    data: {
      custom_id: `chg:submit:${week}:${slots}`,
      title: '일정 변경 요청',
      components: [{ type: 1, components: [{ type: 4, custom_id: 'reason', label: '간단한 사유', style: 1, min_length: 1, max_length: REASON_MAX, required: true }] }],
    },
  }
}

// 파티 채널에 올라가는 요청 메시지. 후보마다 누가 가능하다고 했는지 보여 준다
function changeMessage(party: PartyDoc, doc: WeekDoc) {
  const change = doc.change!
  const others = party.members.map(m => m.userId).filter(id => id !== change.requesterId)
  const lines = change.options.map((slot) => {
    const ok = change.ok[slot] ?? []
    return `**${slotLabel(doc.week, slot)}** · 가능 ${ok.length} / ${others.length}${ok.length ? ` · ${ok.map(id => partyCharacter(party, id)).join(', ')}` : ''}`
  })
  return {
    content: `🔁 ${partyTag(change.requesterId)}님이 보스 시간 변경을 요청했어요 · ${others.map(partyTag).join(' ')}`,
    embeds: [{
      title: `사유: ${change.reason}`,
      description: `지금: **${slotLabel(doc.week, doc.confirmed!)}**\n\n${lines.join('\n')}`,
      color: PARTY_COLOR,
      footer: { text: '되는 시간을 눌러 주세요. 요청한 사람 말고 모두가 누른 시간으로 바로 바뀌어요' },
    }],
    components: [
      { type: 1, components: change.options.slice(0, 5).map(slot => ({ type: 2, style: 1, label: `${slotLabel(doc.week, slot)} 가능`, custom_id: `chg:ok:${doc.week}:${slot}` })) },
      { type: 1, components: [
        ...change.options.slice(5).map(slot => ({ type: 2, style: 1, label: `${slotLabel(doc.week, slot)} 가능`, custom_id: `chg:ok:${doc.week}:${slot}` })),
        { type: 2, style: 4, label: '요청 취소', custom_id: `chg:cancel:${doc.week}` },
      ] },
    ],
    allowed_mentions: { users: others },
  }
}

export async function submitPartyChange(interaction: DiscordInteraction, event: H3Event) {
  const ctx = await changeContext(interaction)
  if (!ctx) return partyNotice(PARTY_NOT_MEMBER)
  if (!ctx.doc || ctx.doc.confirmed === null) return partyNotice('아직 확정된 보스 시간이 없어요.')
  if (ctx.doc.change) return partyNotice('이미 변경 요청이 진행 중이에요.')
  const allowed = await changeOptions(ctx.party, ctx.doc)
  const options = ctx.extra.split('.').map(Number).filter(slot => allowed.includes(slot))
  const reason = partyModalText(interaction, 'reason').slice(0, REASON_MAX)
  if (!options.length || !reason) return partyNotice('시간과 사유를 다시 적어 주세요.')

  const doc = await patchWeek(ctx.doc, { change: { requesterId: ctx.userId, reason, options, ok: {} } })
  await postWeek(ctx.party, doc, 'change', changeMessage(ctx.party, doc))
  // 요청은 채널에 올라갔으므로, 시간을 고르던 개인 메시지는 지운다
  event.waitUntil(deleteDiscordReply(interaction))
  return { type: RESPONSE.deferredUpdate }
}

// 요청한 사람 말고 모두가 가능하다고 한 시간으로 바꾸고 새로 공지한다. 예전 공지·30분 전 알림·변경 요청은 지운다
async function applyChange(party: PartyDoc, doc: WeekDoc, slot: number) {
  const updated = await patchWeek(doc, { confirmed: slot, change: null }, ['done.remindBoss'])
  await postWeek(party, updated, 'notice', noticeMessage(party, updated, true), ['remindBoss', 'change'])
}

export async function okPartyChange(interaction: DiscordInteraction, event: H3Event) {
  const ctx = await changeContext(interaction)
  if (!ctx) return partyNotice(PARTY_NOT_MEMBER)
  const change = ctx.doc?.change
  const slot = Number(ctx.extra)
  if (!ctx.doc || !change || !change.options.includes(slot)) return partyNotice('이 요청은 끝났어요.')
  if (ctx.userId === change.requesterId) return partyNotice('요청한 사람은 이미 가능한 것으로 쳐요.')

  const before = change.ok[slot] ?? []
  const ok = before.includes(ctx.userId) ? before.filter(id => id !== ctx.userId) : [...before, ctx.userId]
  const doc = await patchWeek(ctx.doc, { [`change.ok.${slot}`]: ok })
  const everyone = ctx.party.members.every(m => m.userId === change.requesterId || ok.includes(m.userId))
  if (!everyone) return { type: RESPONSE.updateMessage, data: changeMessage(ctx.party, doc) }
  // 누른 메시지(변경 요청)를 지워야 해서, 먼저 받았다고만 답하고 뒤에서 바꾼다
  event.waitUntil(applyChange(ctx.party, doc, slot).catch(error => console.error('[leda] 일정 변경 실패', String(error?.message ?? error))))
  return { type: RESPONSE.deferredUpdate }
}

export async function cancelPartyChange(interaction: DiscordInteraction, event: H3Event) {
  const ctx = await changeContext(interaction)
  if (!ctx) return partyNotice(PARTY_NOT_MEMBER)
  if (!ctx.doc?.change) return partyNotice('이 요청은 끝났어요.')
  if (ctx.userId !== ctx.doc.change.requesterId && ctx.userId !== ctx.party.leaderId) return partyNotice('요청한 사람과 파티장만 취소할 수 있어요.')
  const doc = await patchWeek(ctx.doc, { change: null })
  // 일정은 그대로라 요청 메시지만 지운다
  event.waitUntil(clearPosts(ctx.party, doc, ['change']).catch(() => {}))
  return { type: RESPONSE.deferredUpdate }
}
