import { ObjectId, type AnyBulkWriteOperation } from 'mongodb'
import { bossPeriod, crystalPrice, findBoss } from '#shared/data/bosses'
import type { BossClearDoc } from '../../../utils/mongo'

// $setOnInsert라 이미 체크한 보스는 물욕템 기록까지 그대로 남는다
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
