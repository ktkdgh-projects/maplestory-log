import type { H3Event } from 'h3'
import type { PartyLeadAction, PartyLeadResponse } from '#shared/types'
import { PARTY_SLOT_COUNT } from '#shared/data/party'
import type { PartyDoc, WeekDoc, WeekStep } from './db'
import { useBotCollections } from './db'
import { deleteDiscordReply } from './api'
import { PARTY_COLOR, PARTY_EPHEMERAL, PARTY_NOT_MEMBER, RESPONSE, partyNotice, partyOfInteraction, type DiscordInteraction } from './party'
import { partyOfBotUser } from './webAuth'
import { WEEK_STEPS, confirmWeek, partyWeek, patchWeek, runWeekStep, slotStart, slotLabel, weekConflicts, weekRanking, weekStepTime } from './week'

// 버튼 id: lead:confirm:<주>, lead:pick:<칸>:<주>
const STEP_LABELS: Record<WeekStep, string> = {
  announce: '시간 적기 알림',
  remindSubmit: '미제출자 태그',
  startVote: '마감하고 투표 시작',
  askConfirm: '투표 마감',
  autoConfirm: '자동 확정',
  notice: '보스 시간 공지',
  remindBoss: '30분 전 알림',
}
// 공지가 올라가는 때를 "목요일 0시"처럼 적는다
const noticeDay = (doc: WeekDoc) => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', weekday: 'long', hour: 'numeric', hour12: false }).format(weekStepTime(doc, 'notice')!)
const LEADER_ONLY = '파티장만 쓸 수 있어요.'

// 파티장 화면(웹)은 로그인한 사람이 그 파티의 파티장일 때만 쓴다
export async function requirePartyLeader(event: H3Event, partyId: unknown) {
  const found = await partyOfBotUser(event, partyId)
  if (found.userId !== found.party.leaderId) throw createError({ statusCode: 403, message: LEADER_ONLY })
  return found
}

// 파티장 화면(웹)에 보여 줄 이번 주 상태
export async function leaderState(party: PartyDoc, doc: WeekDoc, note = ''): Promise<PartyLeadResponse> {
  const { availability } = await useBotCollections()
  const [submitted, conflicts] = await Promise.all([
    availability.find({ userId: { $in: party.members.map(m => m.userId) }, week: doc.week }, { projection: { userId: 1 } }).toArray(),
    weekConflicts(party, doc.week),
  ])
  const submittedIds = new Set(submitted.map(d => d.userId))
  return {
    week: doc.week,
    partyName: party.name,
    note,
    phase: doc.phase,
    members: party.members.map(m => ({ character: m.character, submitted: submittedIds.has(m.userId), voted: doc.votes[m.userId] !== undefined })),
    candidates: weekRanking(doc).map(c => ({ slot: c.slot, label: slotLabel(doc.week, c.slot), votes: c.votes, missing: c.missing, conflict: conflicts.has(c.slot) })),
    confirmed: doc.confirmed === null ? null : { slot: doc.confirmed, label: slotLabel(doc.week, doc.confirmed) },
    steps: WEEK_STEPS.map(step => ({ key: step, label: STEP_LABELS[step], at: weekStepTime(doc, step)?.toISOString() ?? null, done: !!doc.done[step] })),
    changeOpen: !!doc.change,
    customFromDay: doc.custom?.fromDay ?? null,
  }
}

const HOUR_MS = 60 * 60 * 1000
// 이번 주만 다르게: 마감 3시간 전 미제출 태그 → 마감에 투표 → 3시간 뒤 투표 마감 → 6시간 뒤 공지(평소 수 18시 마감과 같은 간격)
const CUSTOM_OFFSETS: Partial<Record<WeekStep, number>> = { remindSubmit: -3 * HOUR_MS, startVote: 0, askConfirm: 3 * HOUR_MS, autoConfirm: 5 * HOUR_MS + 50 * 60 * 1000, notice: 6 * HOUR_MS }

// 그 주의 진행을 처음으로 되돌리고, 고른 마감과 요일로 지금 알림을 올린다. 이미 적어 둔 시간은 남는다
async function restartCustomWeek(party: PartyDoc, doc: WeekDoc, deadline: string | undefined, fromDay: number | undefined): Promise<WeekDoc> {
  const end = new Date(deadline ?? '')
  if (!Number.isInteger(fromDay) || fromDay! < 0 || fromDay! > 6) throw createError({ statusCode: 400, message: '받을 요일을 골라 주세요.' })
  if (Number.isNaN(end.getTime()) || end.getTime() <= Date.now()) throw createError({ statusCode: 400, message: '마감은 지금보다 뒤로 정해 주세요.' })
  if (end.getTime() + CUSTOM_OFFSETS.notice! >= slotStart(doc.week, PARTY_SLOT_COUNT - 1).getTime()) throw createError({ statusCode: 400, message: '마감이 너무 늦어요. 그 주 수요일 밤보다 6시간 넘게 앞이어야 해요.' })

  const now = new Date()
  const steps = Object.fromEntries(Object.entries(CUSTOM_OFFSETS).map(([step, offset]) => [step, new Date(end.getTime() + offset)]))
  const { weeks } = await useBotCollections()
  await weeks.deleteOne({ _id: doc._id })
  let fresh = await patchWeek(await partyWeek(party._id, doc.week), { custom: { steps: { ...steps, announce: now }, fromDay } })
  // 미제출 태그 시각이 이미 지났으면 건너뛴다
  if (steps.remindSubmit!.getTime() <= now.getTime()) fresh = await patchWeek(fresh, { 'done.remindSubmit': now })
  return runWeekStep(party, fresh, 'announce')
}

// 파티장이 누른 동작 하나를 처리하고, 바뀐 주와 알려 줄 말을 돌려준다
export async function leaderAct(party: PartyDoc, doc: WeekDoc, { action, step, slot, deadline, fromDay }: PartyLeadAction): Promise<{ doc: WeekDoc, note: string }> {
  const bad = (message: string) => createError({ statusCode: 400, message })
  if (action === 'custom') return { doc: await restartCustomWeek(party, doc, deadline, fromDay), note: '이번 주만 다른 일정으로 다시 시작했어요. 채널에 알림을 올렸어요.' }
  if (action === 'run') {
    if (!step || !WEEK_STEPS.includes(step)) throw bad('없는 단계예요.')
    const updated = await runWeekStep(party, doc, step)
    const failed = step === 'startVote' && updated.phase !== 'vote'
    return { doc: updated, note: failed ? '모두 되는 시간이 없어서 투표를 열지 못했어요.' : `${STEP_LABELS[step]}: 채널에 올렸어요.` }
  }
  if (action === 'pick') {
    if (slot === undefined || !doc.candidates.some(c => c.slot === slot) || (await weekConflicts(party, doc.week)).has(slot)) throw bad('고를 수 없는 시간이에요.')
    return { doc: await confirmWeek(party, doc, slot), note: `${slotLabel(doc.week, slot)}로 확정했어요. ${noticeDay(doc)}에 공지돼요.` }
  }
  throw bad('없는 동작이에요.')
}

// 채널의 "결과 보고 확정" 버튼: 투표 결과를 보고 그 자리에서 고른다. 파티원의 다른 일정과 겹치는 시간은 고를 수 없다
async function confirmPanel(party: PartyDoc, doc: WeekDoc) {
  const conflicts = await weekConflicts(party, doc.week)
  const ranking = weekRanking(doc)
  const lines = ranking.map((c, i) => `${i + 1}위 · **${slotLabel(doc.week, c.slot)}** · ${c.votes}표${c.missing ? ' · 한 명 안 됨' : ''}${conflicts.has(c.slot) ? ' · 파티원 일정과 겹쳐요' : ''}`)
  const picks = ranking.map(c => ({ type: 2, style: c.slot === doc.confirmed ? 3 : 1, label: slotLabel(doc.week, c.slot), custom_id: `lead:pick:${c.slot}:${doc.week}`, disabled: conflicts.has(c.slot) }))
  return {
    embeds: [{
      title: `투표 결과 · ${Object.keys(doc.votes).length} / ${party.members.length}명 투표`,
      description: `${lines.join('\n')}\n\n확정할 시간을 눌러 주세요.`,
      color: PARTY_COLOR,
    }],
    components: [picks.slice(0, 5), picks.slice(5)].filter(row => row.length).map(components => ({ type: 1, components })),
    flags: PARTY_EPHEMERAL,
    allowed_mentions: { parse: [] },
  }
}

export async function runLeaderAction(interaction: DiscordInteraction, event: H3Event) {
  const found = await partyOfInteraction(interaction)
  if (!found) return partyNotice(PARTY_NOT_MEMBER)
  if (found.userId !== found.party.leaderId) return partyNotice(LEADER_ONLY)

  const parts = interaction.data!.custom_id!.split(':')
  const doc = await partyWeek(found.party._id, parts.at(-1)!)
  if (parts[1] === 'confirm') {
    if (!doc.candidates.length) return partyNotice('아직 투표 후보가 없어요.')
    return { type: RESPONSE.message, data: await confirmPanel(found.party, doc) }
  }
  if (parts[1] === 'pick') {
    await leaderAct(found.party, doc, { action: 'pick', slot: Number(parts[2]) })
    // 확정은 채널의 투표 메시지에 표시되므로, 나만 보이던 결과 창은 지운다
    event.waitUntil(deleteDiscordReply(interaction))
    return { type: RESPONSE.deferredUpdate }
  }
  return partyNotice('아직 없는 기능이에요.')
}
