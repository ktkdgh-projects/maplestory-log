import type { SnapshotsResponse } from '#shared/types'

const ALLOWED_DAYS = [7, 14, 30]
// 한 번 부를 때 채우는 시간. 남은 날은 화면이 다시 불러 이어서 채운다
const FILL_BUDGET_MS = 5000

// 캐릭터 이름만으로 최근 성장 기록을 본다. 로그인하지 않았으면 서버 키를 쓰고, 채운 기록은 다른 사용자와 같이 쓴다
export default defineEventHandler(async (event): Promise<SnapshotsResponse> => {
  const query = getQuery(event)
  const name = typeof query.name === 'string' ? query.name.trim() : ''
  if (!name || name.length > 20) throw createError({ statusCode: 400, message: '캐릭터 이름을 확인해 주세요.' })
  const days = ALLOWED_DAYS.includes(Number(query.days)) ? Number(query.days) : 14
  const apiKey = await searchApiKey(event, 'growth-search')

  try {
    // 캐릭터 정보와 오늘 값은 10분 캐시라, 기간만 바꾸거나 다시 들어오면 넥슨을 부르지 않는다
    let [live, paused] = await Promise.all([resolveOcid(apiKey, name).then(ocid => fetchLive(apiKey, ocid)), isCollectionPaused()])
    // 이름이 다르면 캐시된 ocid가 이름을 바꾼 다른 캐릭터이거나 캐시가 이름을 바꾸기 전 것이라 새로 찾는다
    if (live.character.name !== name) {
      const ocid = (await nexon.ocid(apiKey, name)).ocid
      live = await fetchLive(apiKey, ocid, ocid === live.character.ocid)
    }
    const { ocid } = live.character

    const dates = recentKstDates(days)
    const pending = paused ? 0 : await fillSnapshots(apiKey, ocid, dates, FILL_BUDGET_MS)

    const { snapshots } = await useCollections()
    const docs = await snapshots.find({ ocid, date: { $gte: dates[0]!, $lte: dates.at(-1)! }, empty: false }).sort({ date: 1 }).toArray()
    return {
      character: live.character,
      points: docs.map(s => ({ date: s.date, level: s.level, exp: s.exp, expRate: s.expRate, combatPower: s.combatPower })),
      today: paused ? null : live.today,
      pending,
    }
  }
  catch (error) {
    throw toHttpError(error)
  }
})
