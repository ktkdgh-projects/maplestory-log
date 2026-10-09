const ACTIVE_WITHIN_MS = 30 * 24 * 60 * 60 * 1000
const CRON_BUDGET_MS = 40_000

export default defineEventHandler(async (event) => {
  const { cronSecret } = useRuntimeConfig()
  if (!cronSecret || getHeader(event, 'authorization') !== `Bearer ${cronSecret}`) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const { users } = await useCollections()
  const yesterday = kstYesterday()
  const activeUsers = await users.find(
    { keyStatus: { $in: ['valid', 'rate_limited'] }, mainOcid: { $ne: null }, lastSeenAt: { $gt: new Date(Date.now() - ACTIVE_WITHIN_MS) } },
    { projection: { _id: 1, mainOcid: 1 } },
  ).toArray()

  for (const user of activeUsers) {
    await enqueueSnapshotJobs(user._id, user.mainOcid!, [yesterday])
  }
  const { processed } = await processSnapshotJobs({ budgetMs: CRON_BUDGET_MS })
  return { date: yesterday, users: activeUsers.length, processed }
})
