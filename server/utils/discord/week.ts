import type { ObjectId } from 'mongodb'
import { bossPeriod } from '#shared/data/bosses'
import { PARTY_SLOTS_PER_DAY, PARTY_SLOT_COUNT } from '#shared/data/party'
import type { PartyDoc, WeekCandidate, WeekDoc, WeekStep } from './db'
import { useBotCollections } from './db'
import { editDiscordMessage, sendDiscordMessage } from './api'
import { PARTY_COLOR, PARTY_NOT_MEMBER, PARTY_TIME, RESPONSE, partyNotice, partyOfInteraction, partyTag, type DiscordInteraction } from './party'

export const WEEK_STEPS: WeekStep[] = ['announce', 'remindSubmit', 'startVote', 'askConfirm', 'autoConfirm', 'notice', 'remindBoss']
const CANDIDATE_MAX = 10
// 후보가 하루에 몰리지 않게 먼저 하루에 이만큼까지만 뽑는다
const CANDIDATES_PER_DAY = 3
// 같은 조건이면 이 칸(20시)에 가까운 시간을 먼저 올린다
const PRIME_SLOT = 10
const BOSS_REMIND_MS = 30 * 60 * 1000
// 봇이 꺼져 있었거나 주중에 연결한 파티는 이보다 오래 지난 단계를 뒤늦게 올리지 않는다
const STALE_MS = 3 * 60 * 60 * 1000

// 단계 기본 시각: [그 주 목요일에서 며칠 전, 시, 분] (한국 시간)
// 월 0시 알림 → 수 15시 미제출 태그 → 수 18시 마감·투표 → 수 21시 투표 마감 → 목 0시 공지
const STEP_AT: Record<Exclude<WeekStep, 'remindBoss'>, [number, number, number]> = {
  announce: [-3, 0, 0],
  remindSubmit: [-1, 15, 0],
  startVote: [-1, 18, 0],
  askConfirm: [-1, 21, 0],
  autoConfirm: [-1, 23, 50],
  notice: [0, 0, 0],
}

const pad = (n: number) => String(n).padStart(2, '0')
const kstTime = (date: string, hh: number, mm = 0) => new Date(`${date}T${pad(hh)}:${pad(mm)}:00+09:00`)

// 시간을 모으는 주: 다음 목요일부터 일주일
export function partyTargetWeek(): string {
  return addDays(bossPeriod('weekly', kstToday()), 7)
}

function weekDayLabel(week: string, day: number) {
  const date = addDays(week, day)
  return `${WEEKDAYS[kstWeekday(date)]} ${Number(date.slice(5, 7))}/${Number(date.slice(8))}`
}
const slotDay = (slot: number) => Math.floor(slot / PARTY_SLOTS_PER_DAY)
const slotHour = (slot: number) => (slot % PARTY_SLOTS_PER_DAY) * 2
export const slotStart = (week: string, slot: number) => kstTime(addDays(week, slotDay(slot)), slotHour(slot))
// 한 칸이 2시간이라 "토 11/28 20~22시"처럼 범위로 적는다
export const slotLabel = (week: string, slot: number) => `${weekDayLabel(week, slotDay(slot))} ${slotHour(slot)}~${slotHour(slot) + 2}시`

export function weekStepTime(doc: WeekDoc, step: WeekStep): Date | null {
  if (step === 'remindBoss') return doc.confirmed === null ? null : new Date(slotStart(doc.week, doc.confirmed).getTime() - BOSS_REMIND_MS)
  const [days, hh, mm] = STEP_AT[step]
  return kstTime(addDays(doc.week, days), hh, mm)
}

export async function partyWeek(partyId: ObjectId, week: string): Promise<WeekDoc> {
  const { weeks } = await useBotCollections()
  const doc = await weeks.findOneAndUpdate(
    { partyId, week },
    { $setOnInsert: { phase: 'collect', candidates: [], votes: {}, voteMessageId: null, confirmed: null, done: {}, change: null, updatedAt: new Date() } },
    { upsert: true, returnDocument: 'after' },
  )
  return doc!
}

// 'done.notice' 같은 점 표기 키도 받는다
export async function patchWeek(doc: WeekDoc, set: Record<string, unknown>, unset: string[] = []): Promise<WeekDoc> {
  const { weeks } = await useBotCollections()
  const updated = await weeks.findOneAndUpdate(
    { _id: doc._id },
    { $set: { ...set, updatedAt: new Date() }, ...(unset.length && { $unset: Object.fromEntries(unset.map(key => [key, ''])) }) },
    { returnDocument: 'after' },
  )
  return updated!
}

// 제출한 사람 모두가 되는 시간에서 후보를 뽑는다. 금·토 → 앞뒤로 길게 되는 시간 → 20시에 가까운 순
async function weekCandidates(party: PartyDoc, week: string): Promise<WeekCandidate[]> {
  const { availability } = await useBotCollections()
  const docs = await availability.find({ userId: { $in: party.members.map(m => m.userId) }, week }).toArray()
  const submitted = docs.length
  if (!submitted) return []
  const counts = Array.from({ length: PARTY_SLOT_COUNT }, () => 0)
  for (const doc of docs) for (const slot of doc.slots) counts[slot]!++

  const now = Date.now()
  const upcoming = counts.map((_, slot) => slot).filter(slot => slotStart(week, slot).getTime() > now)
  let pool: WeekCandidate[] = upcoming.filter(slot => counts[slot] === submitted).map(slot => ({ slot, missing: 0 }))
  // 모두 되는 시간이 없으면 한 명만 빠지는 시간이라도 보여 준다
  if (!pool.length && submitted >= 3) pool = upcoming.filter(slot => counts[slot] === submitted - 1).map(slot => ({ slot, missing: 1 }))

  const beforeWeekend = (slot: number) => [5, 6].includes(kstWeekday(addDays(week, slotDay(slot))))
  const run = (slot: number) => {
    const first = slotDay(slot) * PARTY_SLOTS_PER_DAY
    let length = 1
    for (let s = slot - 1; s >= first && counts[s] === submitted; s--) length++
    for (let s = slot + 1; s < first + PARTY_SLOTS_PER_DAY && counts[s] === submitted; s++) length++
    return length
  }
  const primeGap = (slot: number) => Math.abs(slot % PARTY_SLOTS_PER_DAY - PRIME_SLOT)
  pool.sort((a, b) => Number(beforeWeekend(b.slot)) - Number(beforeWeekend(a.slot)) || run(b.slot) - run(a.slot) || primeGap(a.slot) - primeGap(b.slot) || a.slot - b.slot)

  const perDay = new Map<number, number>()
  const spread = pool.filter((c) => {
    const used = perDay.get(slotDay(c.slot)) ?? 0
    perDay.set(slotDay(c.slot), used + 1)
    return used < CANDIDATES_PER_DAY
  })
  const rest = pool.filter(c => !spread.includes(c))
  return [...spread, ...rest].slice(0, CANDIDATE_MAX)
}

function weekTally(doc: WeekDoc): Map<number, number> {
  const tally = new Map<number, number>()
  for (const slot of Object.values(doc.votes)) tally.set(slot, (tally.get(slot) ?? 0) + 1)
  return tally
}

// 표가 많은 순서. 표가 같으면 후보를 뽑을 때의 순서(금·토 우선)가 앞선 쪽이 위
export function weekRanking(doc: WeekDoc) {
  const tally = weekTally(doc)
  return doc.candidates.map(c => ({ ...c, votes: tally.get(c.slot) ?? 0 })).sort((a, b) => b.votes - a.votes)
}

// 파티원이 들어간 다른 파티에서 이미 확정한 시간. 어느 파티인지는 밖에 알리지 않는다
export async function weekConflicts(party: PartyDoc, week: string): Promise<Set<number>> {
  const { parties, weeks } = await useBotCollections()
  const others = await parties.find({ '_id': { $ne: party._id }, 'members.userId': { $in: party.members.map(m => m.userId) } }, { projection: { _id: 1 } }).toArray()
  if (!others.length) return new Set()
  const docs = await weeks.find({ partyId: { $in: others.map(p => p._id) }, week, confirmed: { $ne: null } }, { projection: { confirmed: 1 } }).toArray()
  return new Set(docs.map(d => d.confirmed!))
}

const tags = (userIds: string[]) => userIds.map(partyTag).join(' ')
const timeButton = { type: 1, components: [{ type: 2, style: 3, label: '보스 시간 적기', custom_id: PARTY_TIME }] }
const stamp = (date: Date, style: 'f' | 'R') => `<t:${Math.floor(date.getTime() / 1000)}:${style}>`

// 채널에 올리는 메시지는 모두 같은 모양으로 쓴다: 태그 한 줄 + 제목 있는 카드
export function partyCard(title: string, description: string, mention: string[] = [], components: object[] = []) {
  return { content: tags(mention), embeds: [{ title, description, color: PARTY_COLOR }], components, allowed_mentions: { users: mention } }
}

function voteMessage(party: PartyDoc, doc: WeekDoc) {
  const closed = doc.phase !== 'vote'
  const ids = party.members.map(m => m.userId)
  const footer = doc.phase === 'decide' ? '투표가 끝났어요. 파티장이 결과를 보고 확정해요' : closed ? '투표가 끝났어요' : '가장 좋은 시간 하나를 눌러 주세요. 다시 누르면 바뀌어요'
  const lines = weekRanking(doc).map((c, i) => `${i + 1}위 · **${slotLabel(doc.week, c.slot)}** · ${c.votes}표${c.missing ? ' · 한 명 안 됨' : ''}${closed && c.slot === doc.confirmed ? ' ← 확정' : ''}`)
  const voters = party.members.map(m => `${doc.votes[m.userId] !== undefined ? '✅' : '⬜'} ${m.character}`).join('  ')
  const buttons = doc.candidates.map(c => ({ type: 2, style: 1, label: slotLabel(doc.week, c.slot), custom_id: `vote:${doc.week}:${c.slot}` }))
  return {
    // 투표를 열 때 모두 태그한다. 뒤에 메시지를 고칠 때는 알림이 다시 가지 않는다
    content: tags(ids),
    embeds: [{
      title: `🗳️ 보스 시간 투표${closed ? ' · 마감' : ''}`,
      description: `${lines.join('\n')}\n\n**투표 ${Object.keys(doc.votes).length} / ${party.members.length}** · ${voters}${closed ? '' : `\n마감 ${stamp(weekStepTime(doc, 'askConfirm')!, 'R')}`}`,
      color: PARTY_COLOR,
      footer: { text: footer },
    }],
    // 버튼은 한 줄에 5개까지
    components: closed ? [] : [buttons.slice(0, 5), buttons.slice(5)].filter(row => row.length).map(row => ({ type: 1, components: row })),
    allowed_mentions: { users: ids },
  }
}

async function refreshVoteMessage(party: PartyDoc, doc: WeekDoc) {
  if (!doc.voteMessageId) return
  await editDiscordMessage(party.channelId, doc.voteMessageId, voteMessage(party, doc)).catch(error => console.error('[leda] 투표 메시지 고치기 실패', String(error?.message ?? error)))
}

export function noticeMessage(party: PartyDoc, doc: WeekDoc, changed = false) {
  const slot = doc.confirmed!
  return partyCard(
    changed ? '🔁 보스 시간이 바뀌었어요' : '📢 이번 주 보스 시간',
    `## ${slotLabel(doc.week, slot)}\n${stamp(slotStart(doc.week, slot), 'R')}`,
    party.members.map(m => m.userId),
    [{ type: 1, components: [{ type: 2, style: 2, label: '일정 변경 요청', custom_id: `chg:open:${doc.week}` }] }],
  )
}

export async function confirmWeek(party: PartyDoc, doc: WeekDoc, slot: number): Promise<WeekDoc> {
  const confirmed = await patchWeek(doc, { 'phase': 'confirmed', 'confirmed': slot, 'done.autoConfirm': new Date() }, ['done.remindBoss'])
  await refreshVoteMessage(party, confirmed)
  return confirmed
}

// 한 단계를 돌리고 했다고 표시한다. 정해진 시각에도, 파티장이 손으로 눌러도 여기로 온다
export async function runWeekStep(party: PartyDoc, doc: WeekDoc, step: WeekStep): Promise<WeekDoc> {
  const send = (body: object) => sendDiscordMessage(party.channelId, body)
  const ids = party.members.map(m => m.userId)
  const range = `${weekDayLabel(doc.week, 0)} ~ ${weekDayLabel(doc.week, 6)}`

  if (step === 'announce') {
    await send(partyCard('🗓️ 보스 시간을 적어 주세요', `**${range}** 중 되는 시간을 적어 주세요.\n마감 ${stamp(weekStepTime(doc, 'startVote')!, 'f')}`, ids, [timeButton]))
  }
  else if (step === 'remindSubmit' && doc.phase === 'collect') {
    const { availability } = await useBotCollections()
    const submitted = new Set((await availability.find({ userId: { $in: ids }, week: doc.week }, { projection: { userId: 1 } }).toArray()).map(d => d.userId))
    const missing = ids.filter(id => !submitted.has(id))
    if (missing.length) await send(partyCard('⏰ 아직 보스 시간을 안 적었어요', `**${range}** · 마감 ${stamp(weekStepTime(doc, 'startVote')!, 'R')}`, missing, [timeButton]))
  }
  else if (step === 'startVote' && doc.phase === 'collect') {
    const candidates = await weekCandidates(party, doc.week)
    if (!candidates.length) {
      await send(partyCard('😵 모두 되는 시간이 없어요', '파티원과 시간을 다시 맞춰 주세요.', [party.leaderId]))
    }
    else {
      doc = await patchWeek(doc, { phase: 'vote', candidates, votes: {} })
      const message = await send(voteMessage(party, doc))
      doc = await patchWeek(doc, { voteMessageId: message.id })
    }
  }
  else if (step === 'askConfirm' && doc.phase === 'vote') {
    // 따로 알리지 않고 투표를 닫고, 파티장에게 확정을 맡긴다
    doc = await patchWeek(doc, { phase: 'decide' })
    await refreshVoteMessage(party, doc)
    await send(partyCard('👑 보스 시간을 확정해 주세요', '투표가 끝났어요. 파티장이 결과를 보고 확정해요.', [party.leaderId], [{ type: 1, components: [{ type: 2, style: 1, label: '결과 보고 확정', custom_id: `lead:confirm:${doc.week}` }] }]))
  }
  else if (step === 'autoConfirm' && (doc.phase === 'vote' || doc.phase === 'decide')) {
    // 파티장이 확정하지 않았으면 순위가 가장 높은 후보로 정한다
    const conflicts = await weekConflicts(party, doc.week)
    const best = weekRanking(doc).find(c => !conflicts.has(c.slot))
    if (best) doc = await confirmWeek(party, doc, best.slot)
  }
  else if (step === 'notice' && doc.confirmed !== null) {
    await send(noticeMessage(party, doc))
  }
  else if (step === 'remindBoss' && doc.confirmed !== null) {
    await send(partyCard('⚔️ 30분 뒤 보스예요', `## ${slotLabel(doc.week, doc.confirmed)}`, ids))
  }
  return patchWeek(doc, { [`done.${step}`]: new Date() })
}

// 그 시각에 진행 중인 주: 가장 최근 월요일 0시에 알림이 나간 주의 목요일
function cycleWeek(now: Date): string {
  const today = kstDateOf(now)
  return addDays(today, -((kstWeekday(today) + 6) % 7) + 3)
}

// 5분마다 깨워져서, 시각이 지났는데 아직 안 한 단계를 차례로 돌린다
export async function tickParties(now = new Date()): Promise<number> {
  const { parties, weeks } = await useBotCollections()
  let ran = 0
  for (const party of await parties.find().toArray()) {
    try {
      await partyWeek(party._id, cycleWeek(now))
      for (let doc of await weeks.find({ partyId: party._id, week: { $gte: addDays(kstDateOf(now), -7) } }).toArray()) {
        for (const step of WEEK_STEPS) {
          const at = weekStepTime(doc, step)
          if (!at || at > now || doc.done[step]) continue
          doc = now.getTime() - at.getTime() > STALE_MS ? await patchWeek(doc, { [`done.${step}`]: now }) : await runWeekStep(party, doc, step)
          ran++
        }
      }
    }
    catch (error) {
      console.error('[leda] 단계 실행 실패', party.name, String((error as Error)?.message ?? error))
    }
  }
  return ran
}

export async function castPartyVote(interaction: DiscordInteraction) {
  const found = await partyOfInteraction(interaction)
  if (!found) return partyNotice(PARTY_NOT_MEMBER)
  const [, week, slotText] = interaction.data!.custom_id!.split(':')
  const slot = Number(slotText)
  const { weeks } = await useBotCollections()
  const doc = await weeks.findOne({ partyId: found.party._id, week })
  if (!doc || doc.phase !== 'vote' || !doc.candidates.some(c => c.slot === slot)) return partyNotice('이 투표는 끝났어요.')

  const updated = await patchWeek(doc, { [`votes.${found.userId}`]: slot })
  // 누른 메시지가 곧 투표 메시지라 그 자리에서 고친다
  return { type: RESPONSE.updateMessage, data: voteMessage(found.party, updated) }
}
