import type { ObjectId } from 'mongodb'
import type { SnapshotPoint, SnapshotsResponse } from '#shared/types'
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

const LIVE_CACHE_MS = 10 * 60 * 1000

// 오늘은 날짜 지정 조회가 안 되므로 실시간 값으로 진행 중인 하루를 만들고, 같은 응답의 캐릭터 정보와 함께 캐시한다. 키는 함수로 주면 캐시가 없을 때만 꺼낸다
export function fetchLive(apiKey: string | (() => Promise<string>), ocid: string, fresh = false): Promise<{ character: NonNullable<SnapshotsResponse['character']>, today: SnapshotPoint }> {
  return withCache(`live:${ocid}`, LIVE_CACHE_MS, async () => {
    const key = typeof apiKey === 'function' ? await apiKey() : apiKey
    const basic = await nexon.basic(key, ocid)
    const stat = await nexon.stat(key, ocid)
    const character = { ocid, name: basic.character_name ?? '', world: basic.world_name, job: basic.character_class, level: basic.character_level, imageUrl: characterImageUrl(basic.character_image) }
    await saveCharacter(character)
    return {
      character,
      today: {
        date: kstToday(),
        level: basic.character_level,
        exp: basic.character_exp,
        expRate: Number(basic.character_exp_rate),
        combatPower: combatPowerOf(stat),
      },
    }
  }, fresh)
}

async function missingDates(ocid: string, dates: string[]): Promise<string[]> {
  const { snapshots } = await useCollections()
  const validDates = dates.filter(date => date >= NEXON_DATA_START_DATE)
  const existing = await snapshots.find({ ocid, date: { $in: validDates } }, { projection: { date: 1 } }).toArray()
  const have = new Set(existing.map(s => s.date))
  return validDates.filter(date => !have.has(date))
}

// 로그인 없이 검색한 캐릭터는 작업 대기열 없이 그 자리에서 최근 날부터 채운다. 남은 날 수를 돌려준다
export async function fillSnapshots(apiKey: string, ocid: string, dates: string[], budgetMs: number): Promise<number> {
  const { snapshots } = await useCollections()
  const missing = (await missingDates(ocid, dates)).reverse()
  const deadline = Date.now() + budgetMs
  let done = 0
  for (const date of missing) {
    if (Date.now() >= deadline) break
    const snapshot = await fetchSnapshot(apiKey, ocid, date)
    await snapshots.updateOne({ ocid, date }, { $set: { ...snapshot, fetchedAt: new Date() } }, { upsert: true })
    done++
  }
  return missing.length - done
}

// 빈 날 수를 돌려준다
export async function enqueueSnapshotJobs(userId: ObjectId, ocid: string, dates: string[]): Promise<number> {
  const { jobs } = await useCollections()
  const missing = await missingDates(ocid, dates)
  if (missing.length === 0) return 0

  const now = new Date()
  await Promise.all([
    jobs.bulkWrite(missing.map(date => ({
      updateOne: {
        filter: { type: 'snapshot' as const, ocid, date },
        update: { $setOnInsert: { userId, status: 'pending' as const, attempts: 0, runAt: now, lockedAt: null, error: null, createdAt: now } },
        upsert: true,
      },
    }))),
    // 키를 다시 등록한 뒤라면 실패로 끝난 작업도 다시 시도한다
    jobs.updateMany(
      { type: 'snapshot', ocid, date: { $in: missing }, status: 'failed' },
      { $set: { userId, status: 'pending', attempts: 0, runAt: now, error: null } },
    ),
  ])
  return missing.length
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
  await Promise.all([
    jobs.updateOne({ _id: job._id }, { $set: { lockedAt: null, ...update } }),
    jobLogs.insertOne({ at: new Date(), userId: job.userId, ocid: job.ocid, date: job.date, result, ms: Date.now() - startedAt }),
  ])
}

const later = (ms: number) => new Date(Date.now() + ms)

export async function processSnapshotJobs(options: { budgetMs: number, userId?: ObjectId }) {
  const { snapshots, jobs, users } = await useCollections()
  const deadline = Date.now() + options.budgetMs
  const skippedUsers: ObjectId[] = []
  // 같은 사용자 작업이 이어지면 키를 매번 DB에서 꺼내 풀지 않는다
  const keys = new Map<string, Promise<string>>()
  let processed = 0

  while (Date.now() < deadline) {
    const job = await claimJob({
      type: 'snapshot',
      ...(options.userId ? { userId: options.userId } : { userId: { $nin: skippedUsers } }),
    })
    if (!job) break

    const startedAt = Date.now()
    try {
      const userKey = job.userId.toHexString()
      if (!keys.has(userKey)) keys.set(userKey, getUserApiKey(job.userId))
      const snapshot = await fetchSnapshot(await keys.get(userKey)!, job.ocid, job.date)
      await Promise.all([
        snapshots.updateOne({ ocid: job.ocid, date: job.date }, { $set: { ...snapshot, fetchedAt: new Date() } }, { upsert: true }),
        finishJob(job, snapshot.empty ? 'empty' : 'ok', startedAt, { status: 'done', error: null }),
        users.updateOne({ _id: job.userId, keyStatus: 'rate_limited' }, { $set: { keyStatus: 'valid', keyStatusReason: null, keyCheckedAt: new Date() } }),
      ])
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
