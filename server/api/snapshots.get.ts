import type { SnapshotsResponse } from '#shared/types'

const ALLOWED_DAYS = [7, 14, 30]
const VISIT_BUDGET_MS = 5000

export default defineEventHandler(async (event): Promise<SnapshotsResponse> => {
  const user = requireUser(event)
  const days = Number(getQuery(event).days)
  const range = ALLOWED_DAYS.includes(days) ? days : 14
  if (!user.mainOcid) return { character: null, points: [], pending: 0 }

  const ocid = user.mainOcid
  const dates = recentKstDates(range)
  // Cron이 밀렸거나 처음 들어온 경우 빈 날을 접속한 김에 채운다. 남은 건 다음 요청이 이어받는다
  if (user.keyStatus === 'valid') {
    await enqueueSnapshotJobs(user._id, ocid, dates)
    await processSnapshotJobs({ budgetMs: VISIT_BUDGET_MS, userId: user._id })
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
    pending,
  }
})
