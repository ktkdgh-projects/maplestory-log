import type { SnapshotPoint, SnapshotsResponse } from '#shared/types'

const ALLOWED_DAYS = [7, 14, 30]
const VISIT_BUDGET_MS = 5000

export default defineEventHandler(async (event): Promise<SnapshotsResponse> => {
  const user = requireUser(event)
  const query = getQuery(event)
  const days = Number(query.days)
  const range = ALLOWED_DAYS.includes(days) ? days : 14
  const ocid = typeof query.ocid === 'string' ? query.ocid : user.mainOcid
  if (!ocid) return { character: null, points: [], today: null, pending: 0 }

  const [tracked, paused, pendingBefore] = await Promise.all([isTracked(user._id, ocid), isCollectionPaused(), countPendingJobs(ocid)])
  if (!tracked) throw createError({ statusCode: 403, message: '성장 기록을 모으는 캐릭터만 볼 수 있어요.' })

  const dates = recentKstDates(range)
  const collect = user.keyStatus === 'valid' && !paused
  if (collect) {
    // Cron이 밀렸거나 처음 들어온 경우 빈 날을 접속한 김에 채운다. 남은 건 다음 요청이 이어받는다
    const missing = await enqueueSnapshotJobs(user._id, ocid, dates)
    if (missing || pendingBefore) await processSnapshotJobs({ budgetMs: VISIT_BUDGET_MS, userId: user._id })
  }

  const { snapshots, characters } = await useCollections()
  const [docs, character, pending, today] = await Promise.all([
    snapshots.find({ ocid, date: { $gte: dates[0]!, $lte: dates.at(-1)! }, empty: false }).sort({ date: 1 }).toArray(),
    characters.findOne({ ocid }),
    countPendingJobs(ocid),
    // 오늘 값은 덤이라 실패해도 기록 화면은 그대로 보여준다
    collect
      ? fetchLive(() => getUserApiKey(user._id), ocid).then(live => live.today).catch((error): SnapshotPoint | null => {
          console.warn('[snapshots] 오늘 값을 못 불러옴', redactApiKeys(String(error)))
          return null
        })
      : null,
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
