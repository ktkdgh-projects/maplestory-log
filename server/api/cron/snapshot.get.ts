const ACTIVE_WITHIN_MS = 30 * 24 * 60 * 60 * 1000
const CRON_BUDGET_MS = 40_000

export default defineEventHandler(async (event) => {
  const { cronSecret } = useRuntimeConfig()
  if (!cronSecret || getHeader(event, 'authorization') !== `Bearer ${cronSecret}`) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

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
