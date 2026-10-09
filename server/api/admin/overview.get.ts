import type { AdminOverview, KeyStatus } from '#shared/types'

const ACTIVE_WITHIN_MS = 30 * 24 * 60 * 60 * 1000
const LOG_LIMIT = 50

export default defineEventHandler(async (event): Promise<AdminOverview> => {
  requireAdmin(event)
  const { users, jobs, jobLogs, appSettings } = await useCollections()
  const todayStart = kstDayStart(kstToday())

  const [total, active30d, keyGroups, jobGroups, todayGroups, logs, settings] = await Promise.all([
    users.countDocuments(),
    users.countDocuments({ lastSeenAt: { $gt: new Date(Date.now() - ACTIVE_WITHIN_MS) } }),
    users.aggregate<{ _id: KeyStatus, n: number }>([{ $group: { _id: '$keyStatus', n: { $sum: 1 } } }]).toArray(),
    jobs.aggregate<{ _id: string, n: number }>([{ $match: { status: { $in: ['pending', 'running', 'failed'] } } }, { $group: { _id: '$status', n: { $sum: 1 } } }]).toArray(),
    jobLogs.aggregate<{ _id: string, n: number }>([{ $match: { at: { $gte: todayStart } } }, { $group: { _id: '$result', n: { $sum: 1 } } }]).toArray(),
    jobLogs.find({}).sort({ at: -1 }).limit(LOG_LIMIT).toArray(),
    appSettings.findOne({ _id: 'collection' }),
  ])

  const byKeyStatus: Record<KeyStatus, number> = { valid: 0, invalid: 0, rate_limited: 0, deleted: 0 }
  for (const g of keyGroups) byKeyStatus[g._id] = g.n
  const jobCount = (status: string) => jobGroups.find(g => g._id === status)?.n ?? 0
  const todayCount = (result: string) => todayGroups.find(g => g._id === result)?.n ?? 0

  return {
    users: { total, active30d, byKeyStatus },
    jobs: { pending: jobCount('pending'), running: jobCount('running'), failed: jobCount('failed') },
    today: { ok: todayCount('ok'), empty: todayCount('empty'), failed: todayGroups.filter(g => g._id !== 'ok' && g._id !== 'empty').reduce((s, g) => s + g.n, 0) },
    logs: logs.map(l => ({ at: l.at.toISOString(), user: l.userId.toHexString().slice(-6), ocid: l.ocid.slice(0, 8), date: l.date, result: redactApiKeys(l.result), ms: l.ms })),
    paused: settings?.paused ?? false,
    pausedAt: settings?.pausedAt?.toISOString() ?? null,
  }
})
