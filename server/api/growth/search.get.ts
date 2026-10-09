import type { SnapshotPoint, SnapshotsResponse } from '#shared/types'

const ALLOWED_DAYS = [7, 14, 30]
// 한 번 부를 때 채우는 시간. 남은 날은 화면이 다시 불러 이어서 채운다
const FILL_BUDGET_MS = 5000
const TODAY_CACHE_MS = 10 * 60 * 1000

// 캐릭터 이름만으로 최근 성장 기록을 본다. 로그인하지 않았으면 서버 키를 쓰고, 채운 기록은 다른 사용자와 같이 쓴다
export default defineEventHandler(async (event): Promise<SnapshotsResponse> => {
  const query = getQuery(event)
  const name = typeof query.name === 'string' ? query.name.trim() : ''
  if (!name || name.length > 20) throw createError({ statusCode: 400, message: '캐릭터 이름을 확인해 주세요.' })
  const days = ALLOWED_DAYS.includes(Number(query.days)) ? Number(query.days) : 14
  const apiKey = await searchApiKey(event, 'growth-search')

  try {
    let ocid = await resolveOcid(apiKey, name)
    let basic = await nexon.basic(apiKey, ocid)
    // 이름을 바꾼 캐릭터면 캐시된 ocid가 다른 캐릭터를 가리키므로 새로 찾는다
    if (basic.character_name !== name) {
      ocid = (await nexon.ocid(apiKey, name)).ocid
      basic = await nexon.basic(apiKey, ocid)
    }
    const character = { ocid, name: basic.character_name ?? name, world: basic.world_name, job: basic.character_class, level: basic.character_level, imageUrl: characterImageUrl(basic.character_image) }
    await saveCharacter(character)

    const dates = recentKstDates(days)
    const paused = await isCollectionPaused()
    const pending = paused ? 0 : await fillSnapshots(apiKey, ocid, dates, FILL_BUDGET_MS)
    const today: SnapshotPoint | null = paused
      ? null
      : await withCache(`today:${ocid}`, TODAY_CACHE_MS, () => fetchTodayPoint(apiKey, ocid)).catch(() => null)

    const { snapshots } = await useCollections()
    const docs = await snapshots.find({ ocid, date: { $gte: dates[0]!, $lte: dates.at(-1)! }, empty: false }).sort({ date: 1 }).toArray()
    return {
      character,
      points: docs.map(s => ({ date: s.date, level: s.level, exp: s.exp, expRate: s.expRate, combatPower: s.combatPower })),
      today,
      pending,
    }
  }
  catch (error) {
    throw toHttpError(error)
  }
})
