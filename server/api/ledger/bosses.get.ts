import type { BossBoardResponse, BossRosterCharacter } from '#shared/types'
import { WEEKLY_BOSS_LIMIT, bossOrder, bossPeriod, findBoss } from '#shared/data/bosses'
import type { BossClearDoc } from '../../utils/mongo'

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export default defineEventHandler(async (event): Promise<BossBoardResponse> => {
  const user = requireUser(event)
  const query = getQuery(event).week
  const week = bossPeriod('weekly', typeof query === 'string' && DATE_PATTERN.test(query) && realDate(query) ? query : kstToday())
  // 주가 두 달에 걸치면 월간 보스(검은 마법사)는 두 달 것을 모두 보여준다
  const months = [bossPeriod('monthly', week), bossPeriod('monthly', addDays(week, 6))]

  const { bossClears } = await useCollections()
  const [{ characters, editable }, clears] = await Promise.all([
    rosterForWeek(user._id, week),
    bossClears.find({ userId: user._id, period: { $in: [week, ...months] } }).toArray(),
  ])
  const roster = editable ? await withLatestInfo(characters) : await withWeekClears(characters, clears, week)
  return { week, editable, roster, clears: clears.map(toBossClear) }
})

// 명단에는 고를 때의 레벨·이름이 남아 있어서, 그 뒤 조회로 새로 받아 둔 캐릭터 정보로 덮어 보여 준다
async function withLatestInfo(list: BossRosterCharacter[]) {
  const { characters } = await useCollections()
  const docs = await characters.find({ ocid: { $in: list.map(c => c.ocid) } }, { projection: { ocid: 1, name: 1, job: 1, level: 1, imageUrl: 1 } }).toArray()
  const latest = new Map(docs.map(c => [c.ocid, c]))
  return list.map((c) => {
    const doc = latest.get(c.ocid)
    return doc ? { ...c, name: doc.name, job: doc.job, level: doc.level, imageUrl: doc.imageUrl ?? c.imageUrl } : c
  })
}

// 지난 주는 그 주에 실제로 잡은 기록이 먼저다. 명단에 없던 보스·캐릭터도 넣고, 난이도·인원은 잡은 기록대로 보여 준다
async function withWeekClears(list: BossRosterCharacter[], clears: BossClearDoc[], week: string) {
  const end = addDays(week, 6)
  const inWeek = clears.filter(c => (findBoss(c.bossId)?.cycle === 'monthly' ? c.date >= week && c.date <= end : c.period === week))
  const roster = list.map(c => ({ ...c, bosses: [...c.bosses] }))
  const missing = [...new Set(inWeek.map(c => c.ocid).filter(ocid => !roster.some(r => r.ocid === ocid)))]
  if (missing.length) {
    const { characters } = await useCollections()
    const docs = await characters.find({ ocid: { $in: missing } }).toArray()
    for (const ocid of missing) {
      const doc = docs.find(d => d.ocid === ocid)
      const name = doc?.name ?? inWeek.find(c => c.ocid === ocid)!.name
      roster.push({ ocid, name, world: doc?.world ?? '', job: doc?.job ?? '', level: doc?.level ?? 0, imageUrl: doc?.imageUrl ?? null, bosses: [] })
    }
  }
  for (const clear of inWeek) {
    const character = roster.find(r => r.ocid === clear.ocid)!
    const pick = { bossId: clear.bossId, difficulty: clear.difficulty, party: clear.party }
    const i = character.bosses.findIndex(b => b.bossId === clear.bossId)
    if (i < 0) character.bosses.push(pick)
    else character.bosses[i] = pick
  }
  // 그때 세팅이 안 남은 주는 지금 세팅에 잡은 기록을 더해 보여 주므로 주간 보스가 한도를 넘을 수 있다. 넘으면 그 주에 안 잡은 보스부터 뺀다
  for (const c of roster) {
    const cleared = new Set(inWeek.filter(x => x.ocid === c.ocid).map(x => x.bossId))
    let over = c.bosses.filter(b => findBoss(b.bossId)?.cycle === 'weekly').length - WEEKLY_BOSS_LIMIT
    c.bosses = c.bosses.filter(b => over <= 0 || cleared.has(b.bossId) || findBoss(b.bossId)?.cycle !== 'weekly' || !over--)
    c.bosses.sort((a, b) => bossOrder(a.bossId) - bossOrder(b.bossId))
  }
  return roster
}
