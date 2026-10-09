import { ObjectId, type AnyBulkWriteOperation } from 'mongodb'
import { bossPeriod, crystalPrice, findBoss } from '#shared/data/bosses'
import type { BossClearDoc } from '../../../utils/mongo'

// 세팅한 주간 보스를 한 번에 체크한다. ocid가 없으면 세팅한 캐릭터 전부. 이미 체크한 보스(물욕템 기록 포함)는 그대로 둔다
export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const body = await readBody<{ ocid?: unknown, date?: unknown }>(event)
  const date = parseDate(body?.date)
  const period = bossPeriod('weekly', date)

  const { bossRosters, bossClears } = await useCollections()
  const roster = await bossRosters.findOne({ userId: user._id })
  const characters = (roster?.characters ?? []).filter(c => body?.ocid === undefined || c.ocid === body.ocid)
  if (!characters.length) throw createError({ statusCode: 400, message: '보스 세팅에 없는 캐릭터예요.' })

  const now = new Date()
  const writes: AnyBulkWriteOperation<BossClearDoc>[] = characters.flatMap(c => c.bosses
    .filter(pick => findBoss(pick.bossId)?.cycle === 'weekly')
    .map(pick => ({
      updateOne: {
        filter: { userId: user._id, ocid: c.ocid, period, bossId: pick.bossId },
        update: { $setOnInsert: { _id: new ObjectId(), name: c.name, difficulty: pick.difficulty, party: pick.party, date, meso: crystalPrice(pick.bossId, pick.difficulty, pick.party)!, createdAt: now } },
        upsert: true,
      },
    })))
  const result = writes.length ? await bossClears.bulkWrite(writes, { ordered: false }) : null
  return { added: result?.upsertedCount ?? 0 }
})
