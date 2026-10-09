import { ObjectId } from 'mongodb'
import { WEEKLY_BOSS_LIMIT, bossPeriod, crystalPrice, findBoss } from '#shared/data/bosses'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const body = await readBody<{ ocid?: unknown, bossId?: unknown, date?: unknown }>(event)
  const date = parseDate(body?.date)

  // 난이도·파티 인원은 저장해 둔 세팅에서 가져와 클라이언트가 가격을 바꿔 보낼 수 없게 한다
  const { bossRosters, bossClears } = await useCollections()
  const roster = await bossRosters.findOne({ userId: user._id })
  const character = roster?.characters.find(c => c.ocid === body?.ocid)
  const pick = character?.bosses.find(b => b.bossId === body?.bossId)
  const boss = pick && findBoss(pick.bossId)
  if (!character || !pick || !boss) throw createError({ statusCode: 400, message: '보스 세팅에 없는 보스예요.' })

  const period = bossPeriod(boss.cycle, date)
  if (boss.cycle === 'weekly') {
    const weekly = await bossClears.countDocuments({ userId: user._id, ocid: character.ocid, period })
    if (weekly >= WEEKLY_BOSS_LIMIT) throw createError({ statusCode: 409, message: `이번 주 ${WEEKLY_BOSS_LIMIT}개를 이미 다 잡았어요.` })
  }

  const _id = new ObjectId()
  const result = await bossClears.updateOne(
    { userId: user._id, ocid: character.ocid, period, bossId: boss.id },
    { $setOnInsert: { _id, name: character.name, difficulty: pick.difficulty, party: pick.party, date, meso: crystalPrice(boss.id, pick.difficulty, pick.party)!, createdAt: new Date() } },
    { upsert: true },
  )
  if (!result.upsertedCount) throw createError({ statusCode: 409, message: '이번 주기에 이미 잡은 보스예요.' })
  return { id: _id.toHexString() }
})
