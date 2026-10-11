import { createHash, timingSafeEqual } from 'node:crypto'

const ACTIVE_WITHIN_MS = 30 * 24 * 60 * 60 * 1000
const CRON_BUDGET_MS = 40_000

// 앞부분이 얼마나 맞는지가 응답 시간으로 새지 않게 같은 길이의 해시로 바꿔 비교한다
function sameSecret(given: string, expected: string): boolean {
  const digest = (value: string) => createHash('sha256').update(value).digest()
  return timingSafeEqual(digest(given), digest(expected))
}

export default defineEventHandler(async (event) => {
  const { cronSecret } = useRuntimeConfig()
  if (!cronSecret || !sameSecret(getHeader(event, 'authorization') ?? '', `Bearer ${cronSecret}`)) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
  if (await isCollectionPaused()) return { paused: true }

  const { users, userCharacters } = await useCollections()
  const yesterday = kstYesterday()
  const activeUsers = await users.find(
    { keyStatus: { $in: ['valid', 'rate_limited'] }, mainOcid: { $ne: null }, lastSeenAt: { $gt: new Date(Date.now() - ACTIVE_WITHIN_MS) } },
    { projection: { _id: 1 } },
  ).toArray()

  const tracked = await userCharacters.find({ userId: { $in: activeUsers.map(u => u._id) } }).toArray()
  for (const t of tracked) {
    await enqueueSnapshotJobs(t.userId, t.ocid, [yesterday])
  }
  const { processed } = await processSnapshotJobs({ budgetMs: CRON_BUDGET_MS })
  return { date: yesterday, users: activeUsers.length, characters: tracked.length, processed }
})
