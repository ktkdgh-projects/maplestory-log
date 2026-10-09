import { MongoClient, type Db, type ObjectId } from 'mongodb'
import type { KeyStatus } from '#shared/types'

export interface UserDoc {
  _id: ObjectId
  nexonAccountId: string
  keyEnc: { iv: string, tag: string, data: string } | null
  keyVersion: number
  keyHash: string | null
  keyLast4: string | null
  keyStatus: KeyStatus
  keyStatusReason: string | null
  keyCheckedAt: Date | null
  mainOcid: string | null
  consentAt: Date
  createdAt: Date
  lastSeenAt: Date
}

export interface SessionDoc {
  _id: ObjectId
  tokenHash: string
  prevTokenHash: string | null
  prevValidUntil: Date | null
  userId: ObjectId
  device: string
  remember: boolean
  createdAt: Date
  lastUsedAt: Date
  rotatedAt: Date
  expiresAt: Date
}

export interface CharacterDoc {
  ocid: string
  name: string
  world: string
  job: string
  level: number
  imageUrl: string | null
  updatedAt: Date
}

interface UserCharacterDoc {
  userId: ObjectId
  ocid: string
  isMain: boolean
  trackedSince: Date
}

export interface SnapshotDoc {
  ocid: string
  date: string
  empty: boolean
  level: number
  exp: number
  expRate: number
  combatPower: number | null
  data: { name: string, world: string, job: string, imageUrl: string } | null
  fetchedAt: Date
}

export interface JobDoc {
  _id: ObjectId
  type: 'snapshot'
  userId: ObjectId
  ocid: string
  date: string
  status: 'pending' | 'running' | 'done' | 'failed'
  attempts: number
  runAt: Date
  lockedAt: Date | null
  error: string | null
  createdAt: Date
}

interface JobLogDoc {
  at: Date
  userId: ObjectId
  ocid: string
  date: string
  result: string
  ms: number
}

interface CacheDoc {
  _id: string
  data: unknown
  expireAt: Date
}

interface RateLimitDoc {
  _id: string
  count: number
  expireAt: Date
}

// 서버리스 인스턴스와 dev HMR 재로드 사이에서 연결을 재사용하려고 전역에 둔다
const globalForMongo = globalThis as typeof globalThis & {
  __mongoClient?: Promise<MongoClient>
  __mongoIndexes?: Promise<void>
}

function getClient(): Promise<MongoClient> {
  if (!globalForMongo.__mongoClient) {
    const { mongoUri } = useRuntimeConfig()
    if (!mongoUri) throw new Error('NUXT_MONGO_URI가 설정되지 않았습니다')

    globalForMongo.__mongoClient = new MongoClient(mongoUri, { maxPoolSize: 10 })
      .connect()
      .catch((error) => {
        // 실패한 Promise를 캐시하면 이후 요청이 전부 실패하므로 비운다
        globalForMongo.__mongoClient = undefined
        throw error
      })
  }
  return globalForMongo.__mongoClient
}

async function ensureIndexes(db: Db) {
  await Promise.all([
    db.collection('users').createIndexes([
      { key: { nexonAccountId: 1 }, unique: true },
      { key: { keyHash: 1 }, unique: true, partialFilterExpression: { keyHash: { $type: 'string' } } },
    ]),
    db.collection('sessions').createIndexes([
      { key: { tokenHash: 1 }, unique: true },
      { key: { prevTokenHash: 1 } },
      { key: { userId: 1 } },
      { key: { expiresAt: 1 }, expireAfterSeconds: 0 },
    ]),
    db.collection('characters').createIndexes([
      { key: { ocid: 1 }, unique: true },
      { key: { name: 1 } },
    ]),
    db.collection('userCharacters').createIndexes([
      { key: { userId: 1, ocid: 1 }, unique: true },
    ]),
    db.collection('snapshots').createIndexes([
      { key: { ocid: 1, date: 1 }, unique: true },
    ]),
    db.collection('jobs').createIndexes([
      { key: { type: 1, ocid: 1, date: 1 }, unique: true },
      { key: { status: 1, runAt: 1 } },
      { key: { userId: 1, status: 1 } },
    ]),
    db.collection('jobLogs').createIndexes([
      { key: { at: 1 }, expireAfterSeconds: 30 * 24 * 60 * 60 },
    ]),
    db.collection('cache').createIndexes([
      { key: { expireAt: 1 }, expireAfterSeconds: 0 },
    ]),
    db.collection('rateLimits').createIndexes([
      { key: { expireAt: 1 }, expireAfterSeconds: 0 },
    ]),
  ])
}

// DB 이름은 연결 문자열 경로(…mongodb.net/<db>)에서 가져온다
async function useDb(): Promise<Db> {
  const db = (await getClient()).db()
  globalForMongo.__mongoIndexes ??= ensureIndexes(db).catch((error) => {
    globalForMongo.__mongoIndexes = undefined
    throw error
  })
  await globalForMongo.__mongoIndexes
  return db
}

export async function useCollections() {
  const db = await useDb()
  return {
    users: db.collection<UserDoc>('users'),
    sessions: db.collection<SessionDoc>('sessions'),
    characters: db.collection<CharacterDoc>('characters'),
    userCharacters: db.collection<UserCharacterDoc>('userCharacters'),
    snapshots: db.collection<SnapshotDoc>('snapshots'),
    jobs: db.collection<JobDoc>('jobs'),
    jobLogs: db.collection<JobLogDoc>('jobLogs'),
    cache: db.collection<CacheDoc>('cache'),
    rateLimits: db.collection<RateLimitDoc>('rateLimits'),
  }
}

export async function withCache<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const { cache } = await useCollections()
  const hit = await cache.findOne({ _id: key, expireAt: { $gt: new Date() } })
  if (hit) return hit.data as T
  const data = await load()
  await cache.updateOne({ _id: key }, { $set: { data, expireAt: new Date(Date.now() + ttlMs) } }, { upsert: true })
  return data
}
