import type { SnapshotPoint, SnapshotsResponse } from '#shared/types'

const ALLOWED_DAYS = [7, 14, 30]
const VISIT_BUDGET_MS = 5000
const TODAY_CACHE_MS = 10 * 60 * 1000

export default defineEventHandler(async (event): Promise<SnapshotsResponse> => {
  const user = requireUser(event)
  const query = getQuery(event)
  const days = Number(query.days)
  const range = ALLOWED_DAYS.includes(days) ? days : 14
  const ocid = typeof query.ocid === 'string' ? query.ocid : user.mainOcid
  if (!ocid) return { character: null, points: [], today: null, pending: 0 }
  if (!(await isTracked(user._id, ocid))) throw createError({ statusCode: 403, message: '성장 기록을 모으는 캐릭터만 볼 수 있어요.' })

  const dates = recentKstDates(range)
  let today: SnapshotPoint | null = null
  if (user.keyStatus === 'valid' && !(await isCollectionPaused())) {
    // Cron이 밀렸거나 처음 들어온 경우 빈 날을 접속한 김에 채운다. 남은 건 다음 요청이 이어받는다
    await enqueueSnapshotJobs(user._id, ocid, dates)
    await processSnapshotJobs({ budgetMs: VISIT_BUDGET_MS, userId: user._id })
    // 오늘 값은 덤이라 실패해도 기록 화면은 그대로 보여준다
    today = await withCache(`today:${ocid}`, TODAY_CACHE_MS, () => fetchTodayPoint(user._id, ocid)).catch((error) => {
      console.warn('[snapshots] 오늘 값을 못 불러옴', redactApiKeys(String(error)))
      return null
    })
  }

  const { snapshots, characters } = await useCollections()
  const [docs, character, pending] = await Promise.all([
    snapshots.find({ ocid, date: { $gte: dates[0]!, $lte: dates.at(-1)! }, empty: false }).sort({ date: 1 }).toArray(),
    characters.findOne({ ocid }),
    countPendingJobs(ocid),
  ])

  return {
    character: character && {
      ocid,
      name: character.name,
      world: character.world,
      job: character.job,
      level: character.level,
      imageUrl: character.imageUrl ?? docs.at(-1)?.data?.imageUrl ?? null,
    },
    points: docs.map(s => ({ date: s.date, level: s.level, exp: s.exp, expRate: s.expRate, combatPower: s.combatPower })),
    today,
    pending,
  }
})
