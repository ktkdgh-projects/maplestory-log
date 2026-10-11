import { bossPeriod } from '#shared/data/bosses'

// 월간 보스는 period가 달라 그대로 남는다
export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const body = await readBody<{ ocid?: unknown, week?: unknown }>(event)
  if (typeof body?.ocid !== 'string' || !body.ocid) throw createError({ statusCode: 400, message: '캐릭터를 확인해 주세요.' })
  const period = bossPeriod('weekly', parseDate(body.week))

  const { bossClears } = await useCollections()
  const { deletedCount } = await bossClears.deleteMany({ userId: user._id, ocid: body.ocid, period })
  return { removed: deletedCount }
})
