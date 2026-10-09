import type { ObjectId } from 'mongodb'
import type { SnapshotPoint } from '#shared/types'
import type { JobDoc, SnapshotDoc } from './mongo'

const MINUTE_MS = 60 * 1000
const STALE_LOCK_MS = 5 * MINUTE_MS
const MAX_ATTEMPTS = 5

async function fetchSnapshot(apiKey: string, ocid: string, date: string): Promise<Omit<SnapshotDoc, 'fetchedAt'>> {
  const basic = await nexon.basic(apiKey, ocid, date)
  // 캐릭터가 생기기 전 날짜는 오류 대신 이름이 null인 응답이 온다
  if (!basic.character_name) {
    return { ocid, date, empty: true, level: 0, exp: 0, expRate: 0, combatPower: null, data: null }
  }
  const stat = await nexon.stat(apiKey, ocid, date)
  return {
    ocid,
    date,
    empty: false,
    level: basic.character_level,
    exp: basic.character_exp,
    expRate: Number(basic.character_exp_rate),
    combatPower: combatPowerOf(stat),
    data: { name: basic.character_name, world: basic.world_name, job: basic.character_class, imageUrl: characterImageUrl(basic.character_image) },
  }
}

// 오늘은 날짜 지정 조회가 안 되므로 실시간 값으로 진행 중인 하루를 만든다
export async function fetchTodayPoint(userId: ObjectId, ocid: string): Promise<SnapshotPoint> {
  const apiKey = await getUserApiKey(userId)
  const basic = await nexon.basic(apiKey, ocid)
  const stat = await nexon.stat(apiKey, ocid)
  return {
    date: kstToday(),
    level: basic.character_level,
    exp: basic.character_exp,
    expRate: Number(basic.character_exp_rate),
    combatPower: combatPowerOf(stat),
  }
}

export async function enqueueSnapshotJobs(userId: ObjectId, ocid: string, dates: string[]) {
  const { snapshots, jobs } = await useCollections()
  const validDates = dates.filter(date => date >= NEXON_DATA_START_DATE)
  const existing = await snapshots.find({ ocid, date: { $in: validDates } }, { projection: { date: 1 } }).toArray()
  const have = new Set(existing.map(s => s.date))
  const missing = validDates.filter(date => !have.has(date))
  if (missing.length === 0) return

  const now = new Date()
  await jobs.bulkWrite(missing.map(date => ({
    updateOne: {
      filter: { type: 'snapshot' as const, ocid, date },
      update: { $setOnInsert: { userId, status: 'pending' as const, attempts: 0, runAt: now, lockedAt: null, error: null, createdAt: now } },
      upsert: true,
    },
  })))
  // 키를 다시 등록한 뒤라면 실패로 끝난 작업도 다시 시도한다
  await jobs.updateMany(
    { type: 'snapshot', ocid, date: { $in: missing }, status: 'failed' },
    { $set: { userId, status: 'pending', attempts: 0, runAt: now, error: null } },
  )
}

async function claimJob(filter: Record<string, unknown>): Promise<JobDoc | null> {
  const { jobs } = await useCollections()
  const now = new Date()
  return jobs.findOneAndUpdate(
    {
      ...filter,
      $or: [
        { status: 'pending', runAt: { $lte: now } },
        { status: 'running', lockedAt: { $lt: new Date(now.getTime() - STALE_LOCK_MS) } },
      ],
    },
    { $set: { status: 'running', lockedAt: now }, $inc: { attempts: 1 } },
    { sort: { date: -1 }, returnDocument: 'after' },
  )
}

async function finishJob(job: JobDoc, result: string, startedAt: number, update: Partial<JobDoc>) {
  const { jobs, jobLogs } = await useCollections()
  await jobs.updateOne({ _id: job._id }, { $set: { lockedAt: null, ...update } })
  await jobLogs.insertOne({ at: new Date(), userId: job.userId, ocid: job.ocid, date: job.date, result, ms: Date.now() - startedAt })
}

const later = (ms: number) => new Date(Date.now() + ms)

export async function processSnapshotJobs(options: { budgetMs: number, userId?: ObjectId }) {
  const { snapshots, jobs, users } = await useCollections()
  const deadline = Date.now() + options.budgetMs
  const skippedUsers: ObjectId[] = []
  let processed = 0

  while (Date.now() < deadline) {
    const job = await claimJob({
      type: 'snapshot',
      ...(options.userId ? { userId: options.userId } : { userId: { $nin: skippedUsers } }),
    })
    if (!job) break

    const startedAt = Date.now()
    try {
      const apiKey = await getUserApiKey(job.userId)
      const snapshot = await fetchSnapshot(apiKey, job.ocid, job.date)
      await snapshots.updateOne({ ocid: job.ocid, date: job.date }, { $set: { ...snapshot, fetchedAt: new Date() } }, { upsert: true })
      await finishJob(job, snapshot.empty ? 'empty' : 'ok', startedAt, { status: 'done', error: null })
      await users.updateOne({ _id: job.userId, keyStatus: 'rate_limited' }, { $set: { keyStatus: 'valid', keyStatusReason: null, keyCheckedAt: new Date() } })
      processed++
    }
    catch (error) {
      const code = error instanceof NexonError ? error.code : 'ERROR'
      const message = redactApiKeys(error instanceof Error ? error.message : String(error))

      if (isError(error) && error.statusCode === 409) {
        await finishJob(job, 'NO_KEY', startedAt, { status: 'failed', error: 'NO_KEY' })
        skippedUsers.push(job.userId)
      }
      else if (error instanceof NexonError && error.isKeyProblem) {
        await markKeyStatus(job.userId, 'invalid', code)
        await jobs.updateMany({ userId: job.userId, status: 'pending' }, { $set: { status: 'failed', error: code } })
        await finishJob(job, code, startedAt, { status: 'failed', error: code })
        skippedUsers.push(job.userId)
      }
      else if (code === NEXON_ERROR.RATE_LIMITED) {
        await markKeyStatus(job.userId, 'rate_limited', code)
        await finishJob(job, code, startedAt, { status: 'pending', runAt: later(60 * MINUTE_MS), error: code })
        skippedUsers.push(job.userId)
        if (options.userId) break
      }
      else if (error instanceof NexonError && (error.isMaintenance || code === NEXON_ERROR.DATA_PREPARING)) {
        await finishJob(job, code, startedAt, { status: 'pending', runAt: later(30 * MINUTE_MS), error: code })
        break
      }
      else {
        const giveUp = code === NEXON_ERROR.INVALID_ID || job.attempts >= MAX_ATTEMPTS
        await finishJob(job, code, startedAt, giveUp
          ? { status: 'failed', error: message }
          : { status: 'pending', runAt: later(10 * MINUTE_MS), error: message })
      }
    }
  }
  return { processed }
}

export async function countPendingJobs(ocid: string) {
  const { jobs } = await useCollections()
  return jobs.countDocuments({ type: 'snapshot', ocid, status: { $in: ['pending', 'running'] } })
}
