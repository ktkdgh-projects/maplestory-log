import type { ObjectId } from 'mongodb'
import { bossPeriod } from '#shared/data/bosses'
import { PARTY_SLOTS_PER_DAY, PARTY_SLOT_COUNT } from '#shared/data/party'
import type { PartyDoc, WeekCandidate, WeekDoc, WeekPostKind, WeekStep } from './db'
import { useBotCollections } from './db'
import { deleteDiscordMessage, editDiscordMessage, sendDiscordMessage } from './api'
import { botPageUrl, botSiteUrl } from './webAuth'
import { PARTY_COLOR, PARTY_NOT_MEMBER, RESPONSE, partyNotice, partyOfInteraction, partyTag, type DiscordInteraction } from './party'

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
// 월 0시 알림 → 수 15시 미제출 태그 → 수 18시 마감·투표 → 수 21시 투표 마감. 목 0시 공지는 확정 때 못 올렸을 때만 쓴다
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
function partyTargetWeek(): string {
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

// 시간표에 적을 주: 이번 주기가 아직 시간을 모으는 중이면 그 주, 아니면 다음 목요일부터
export async function partyEntryWeek(party: PartyDoc): Promise<{ week: string, fromDay: number }> {
  const { weeks } = await useBotCollections()
  const cycle = await weeks.findOne({ partyId: party._id, week: partyCycleWeek() })
  const open = cycle?.phase === 'collect' && weekStepTime(cycle, 'startVote')!.getTime() > Date.now()
  return open ? { week: cycle.week, fromDay: cycle.custom?.fromDay ?? 0 } : { week: partyTargetWeek(), fromDay: 0 }
}

export function weekStepTime(doc: WeekDoc, step: WeekStep): Date | null {
  const custom = doc.custom?.steps[step]
  if (custom) return custom
  if (step === 'remindBoss') return doc.confirmed === null ? null : new Date(slotStart(doc.week, doc.confirmed).getTime() - BOSS_REMIND_MS)
  const [days, hh, mm] = STEP_AT[step]
  return kstTime(addDays(doc.week, days), hh, mm)
}

export async function partyWeek(partyId: ObjectId, week: string): Promise<WeekDoc> {
  const { weeks } = await useBotCollections()
  const doc = await weeks.findOneAndUpdate(
    { partyId, week },
    { $setOnInsert: { phase: 'collect', candidates: [], votes: {}, voteMessageId: null, confirmed: null, done: {}, custom: null, change: null, posts: [], updatedAt: new Date() } },
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
async function weekCandidates(party: PartyDoc, week: string, fromDay: number): Promise<WeekCandidate[]> {
  const { availability } = await useBotCollections()
  const docs = await availability.find({ userId: { $in: party.members.map(m => m.userId) }, week }).toArray()
  const submitted = docs.length
  if (!submitted) return []
  const counts = Array.from({ length: PARTY_SLOT_COUNT }, () => 0)
  for (const doc of docs) for (const slot of doc.slots) counts[slot]!++

  const now = Date.now()
  const upcoming = counts.map((_, slot) => slot).filter(slot => slotDay(slot) >= fromDay && slotStart(week, slot).getTime() > now)
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
// 사이트 주소 설정이 없으면 링크를 만들 수 없으니 버튼 없이 올린다
const timeButtons = (party: PartyDoc) => (botSiteUrl() ? [{ type: 1, components: [{ type: 2, style: 5, label: '보스 시간 적기', url: botPageUrl('time', party._id) }] }] : [])
const stamp = (date: Date, style: 'f' | 'R') => `<t:${Math.floor(date.getTime() / 1000)}:${style}>`

// 채널에 올리는 메시지는 모두 같은 모양으로 쓴다: 태그 한 줄 + 제목 있는 카드
export function partyCard(title: string, description: string, mention: string[] = [], components: object[] = []) {
  return { content: tags(mention), embeds: [{ title, description, color: PARTY_COLOR }], components, allowed_mentions: { users: mention } }
}

function voteMessage(party: PartyDoc, doc: WeekDoc) {
  const closed = doc.phase !== 'vote'
  const ids = party.members.map(m => m.userId)
  const footer = closed ? '투표가 끝났어요. 파티장이 결과를 보고 확정해요' : '가장 좋은 시간 하나를 눌러 주세요. 다시 누르면 바뀌어요'
  const lines = weekRanking(doc).map((c, i) => `${i + 1}위 · **${slotLabel(doc.week, c.slot)}** · ${c.votes}표${c.missing ? ' · 한 명 안 됨' : ''}`)
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
  // 확정하면 투표 메시지가 지워지므로, 표를 받은 시간만 공지에 남긴다
  const voted = weekRanking(doc).filter(c => c.votes > 0).map(c => `${slotLabel(doc.week, c.slot)} · ${c.votes}표${c.slot === slot ? ' ← 확정' : ''}`)
  return partyCard(
    changed ? '🔁 보스 시간이 바뀌었어요' : '📢 이번 주 보스 시간',
    `## ${slotLabel(doc.week, slot)}\n${stamp(slotStart(doc.week, slot), 'R')}${voted.length ? `\n\n**투표 결과**\n${voted.join('\n')}` : ''}`,
    party.members.map(m => m.userId),
    [{ type: 1, components: [{ type: 2, style: 2, label: '일정 변경 요청', custom_id: `chg:open:${doc.week}` }] }],
  )
}

// 그 주에 올린 메시지 중 고른 종류를 채널에서 지운다. 봇이 올린 메시지라 따로 권한이 없어도 되고, 이미 누가 지웠으면 넘어간다
export async function clearPosts(party: PartyDoc, doc: WeekDoc, kinds: WeekPostKind[] | 'all'): Promise<WeekDoc> {
  const targets = (doc.posts ?? []).filter(p => kinds === 'all' || kinds.includes(p.kind))
  if (!targets.length) return doc
  for (const post of targets) await deleteDiscordMessage(party.channelId, post.id).catch(() => {})
  const ids = targets.map(p => p.id)
  const { weeks } = await useBotCollections()
  const updated = await weeks.findOneAndUpdate(
    { _id: doc._id },
    { $pull: { posts: { id: { $in: ids } } }, $set: { updatedAt: new Date(), ...(doc.voteMessageId && ids.includes(doc.voteMessageId) && { voteMessageId: null }) } },
    { returnDocument: 'after' },
  )
  return updated!
}

// 같은 종류의 예전 메시지와 끝난 단계의 메시지를 지우고 새로 올린다. 채널에는 지금 단계 메시지만 남는다
export async function postWeek(party: PartyDoc, doc: WeekDoc, kind: WeekPostKind, body: object, clear: WeekPostKind[] = []): Promise<{ doc: WeekDoc, id: string }> {
  const cleared = await clearPosts(party, doc, [kind, ...clear])
  const message = await sendDiscordMessage(party.channelId, body)
  const { weeks } = await useBotCollections()
  const updated = await weeks.findOneAndUpdate({ _id: cleared._id }, { $push: { posts: { id: message.id, kind } }, $set: { updatedAt: new Date() } }, { returnDocument: 'after' })
  return { doc: updated!, id: message.id }
}

// 확정하면 기다리지 않고 바로 공지한다. 이미 공지한 주를 다른 시간으로 다시 확정하면 바뀌었다고 알린다
export async function confirmWeek(party: PartyDoc, doc: WeekDoc, slot: number): Promise<WeekDoc> {
  const changed = !!doc.done.notice && doc.confirmed !== null && doc.confirmed !== slot
  const confirmed = await patchWeek(doc, { 'phase': 'confirmed', 'confirmed': slot, 'change': null, 'done.autoConfirm': new Date() }, ['done.remindBoss'])
  const posted = await postWeek(party, confirmed, 'notice', noticeMessage(party, confirmed, changed), ['vote', 'askConfirm', 'remindBoss', 'change'])
  // 공지를 올리지 못하면 표시가 남지 않아서, 공지 단계 시각에 다시 올린다
  return patchWeek(posted.doc, { 'done.notice': new Date() })
}

// 한 단계를 돌리고 했다고 표시한다. 정해진 시각에도, 파티장이 손으로 눌러도 여기로 온다
export async function runWeekStep(party: PartyDoc, doc: WeekDoc, step: WeekStep): Promise<WeekDoc> {
  const post = async (kind: WeekPostKind, body: object, clear: WeekPostKind[] = []) => {
    const result = await postWeek(party, doc, kind, body, clear)
    doc = result.doc
    return result.id
  }
  const ids = party.members.map(m => m.userId)
  const range = `${weekDayLabel(doc.week, doc.custom?.fromDay ?? 0)} ~ ${weekDayLabel(doc.week, 6)}`

  if (step === 'announce') {
    await post('announce', partyCard('🗓️ 보스 시간을 적어 주세요', `**${range}** 중 되는 시간을 적어 주세요.\n마감 ${stamp(weekStepTime(doc, 'startVote')!, 'f')}`, ids, timeButtons(party)))
  }
  else if (step === 'remindSubmit' && doc.phase === 'collect') {
    const { availability } = await useBotCollections()
    const submitted = new Set((await availability.find({ userId: { $in: ids }, week: doc.week }, { projection: { userId: 1 } }).toArray()).map(d => d.userId))
    const missing = ids.filter(id => !submitted.has(id))
    if (missing.length) await post('remindSubmit', partyCard('⏰ 아직 보스 시간을 안 적었어요', `**${range}** · 마감 ${stamp(weekStepTime(doc, 'startVote')!, 'R')}`, missing, timeButtons(party)))
  }
  else if (step === 'startVote' && doc.phase === 'collect') {
    const candidates = await weekCandidates(party, doc.week, doc.custom?.fromDay ?? 0)
    if (!candidates.length) {
      await post('empty', partyCard('😵 모두 되는 시간이 없어요', '파티원과 시간을 다시 맞춰 주세요.', [party.leaderId]))
    }
    else {
      doc = await patchWeek(doc, { phase: 'vote', candidates, votes: {} })
      // 투표가 열리면 시간 적기 알림과 태그는 할 일이 끝났으니 지운다
      const id = await post('vote', voteMessage(party, doc), ['announce', 'remindSubmit', 'empty'])
      doc = await patchWeek(doc, { voteMessageId: id })
    }
  }
  else if (step === 'askConfirm' && doc.phase === 'vote') {
    // 따로 알리지 않고 투표를 닫고, 파티장에게 확정을 맡긴다
    doc = await patchWeek(doc, { phase: 'decide' })
    await refreshVoteMessage(party, doc)
    await post('askConfirm', partyCard('👑 보스 시간을 확정해 주세요', '투표가 끝났어요. 파티장이 결과를 보고 확정해요.', [party.leaderId], [{ type: 1, components: [{ type: 2, style: 1, label: '결과 보고 확정', custom_id: `lead:confirm:${doc.week}` }] }]))
  }
  else if (step === 'autoConfirm' && (doc.phase === 'vote' || doc.phase === 'decide')) {
    // 파티장이 확정하지 않았으면 순위가 가장 높은 후보로 정한다
    const conflicts = await weekConflicts(party, doc.week)
    const best = weekRanking(doc).find(c => !conflicts.has(c.slot))
    if (best) doc = await confirmWeek(party, doc, best.slot)
  }
  else if (step === 'notice' && doc.confirmed !== null) {
    // 공지가 올라가면 투표와 확정 요청은 지운다
    await post('notice', noticeMessage(party, doc), ['vote', 'askConfirm'])
  }
  else if (step === 'remindBoss' && doc.confirmed !== null) {
    await post('remindBoss', partyCard('⚔️ 30분 뒤 보스예요', `## ${slotLabel(doc.week, doc.confirmed)}`, ids))
  }
  return patchWeek(doc, { [`done.${step}`]: new Date() })
}

// 그 시각에 진행 중인 주: 가장 최근 월요일 0시에 알림이 나간 주의 목요일. 목~일에는 이번 주 보스, 월~수에는 다가오는 목요일
export function partyCycleWeek(now = new Date()): string {
  const today = kstDateOf(now)
  return addDays(today, -((kstWeekday(today) + 6) % 7) + 3)
}

// 5분마다 깨워져서, 시각이 지났는데 아직 안 한 단계를 차례로 돌린다
export async function tickParties(now = new Date()): Promise<number> {
  const { parties, weeks } = await useBotCollections()
  let ran = 0
  for (const party of await parties.find().toArray()) {
    try {
      await partyWeek(party._id, partyCycleWeek(now))
      for (let doc of await weeks.find({ partyId: party._id, week: { $gte: addDays(kstDateOf(now), -14) } }).toArray()) {
        // 보스 주가 끝나면(다음 목요일) 그 주에 올린 메시지를 모두 지운다
        if (addDays(doc.week, 7) <= kstDateOf(now)) {
          if (doc.posts?.length) await clearPosts(party, doc, 'all')
          continue
        }
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
