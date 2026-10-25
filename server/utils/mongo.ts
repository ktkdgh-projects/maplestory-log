import { MongoClient, type Db } from 'mongodb'
import { ENHANCE_HISTORY_DAYS } from '#shared/data/enhance'
import type { UserDoc, SessionDoc, CharacterDoc, UserCharacterDoc, SnapshotDoc, MemoDoc, ItemSheetDoc, ItemRowDoc, LegacyItemLogDoc, EnhanceEventDoc, HistorySyncDoc, AppSettingsDoc, GuideSettingsDoc, LedgerSettingsDoc, HuntDoc, DropSaleDoc, MesoEntryDoc, BossRosterDoc, BossRosterWeekDoc, BossClearDoc, JobDoc, JobLogDoc, ItemIconDoc, CacheDoc, RateLimitDoc, SundayDoc } from './mongoDocs'

export type * from './mongoDocs'

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
    db.collection('itemSheets').createIndexes([
      { key: { userId: 1, order: 1 } },
    ]),
    db.collection('itemRows').createIndexes([
      { key: { userId: 1, sheetId: 1, order: 1 } },
    ]),
    db.collection('enhanceEvents').createIndexes([
      { key: { userId: 1, eventId: 1 }, unique: true },
      { key: { userId: 1, character: 1, item: 1, at: -1 } },
      // 강화 결산: 장비와 상관없이 캐릭터·기간으로 찾는다
      { key: { userId: 1, character: 1, at: -1 } },
      // 썬데이 결산: 기간에 강화한 캐릭터를 distinct로 찾는다
      { key: { userId: 1, at: -1 } },
      // 모으는 기간이 지난 기록은 DB가 알아서 지운다
      { key: { at: 1 }, expireAfterSeconds: ENHANCE_HISTORY_DAYS * 24 * 60 * 60 },
    ]),
    db.collection('memos').createIndexes([
      { key: { userId: 1, createdAt: -1 } },
    ]),
    db.collection('hunts').createIndexes([
      { key: { userId: 1, date: -1 } },
    ]),
    db.collection('dropSales').createIndexes([
      { key: { userId: 1, date: 1 } },
    ]),
    db.collection('mesoEntries').createIndexes([
      { key: { userId: 1, date: 1 } },
    ]),
    db.collection('bossRosters').createIndexes([
      { key: { userId: 1 }, unique: true },
    ]),
    db.collection('bossRosterWeeks').createIndexes([
      { key: { userId: 1, week: -1 }, unique: true },
    ]),
    db.collection('bossClears').createIndexes([
      { key: { userId: 1, ocid: 1, period: 1, bossId: 1 }, unique: true },
      { key: { userId: 1, date: 1 } },
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
  // 인덱스는 이미 있어서 확인만 하는 일이라, 서버가 깨어난 첫 요청이 기다리지 않게 뒤에서 돌린다
  globalForMongo.__mongoIndexes ??= ensureIndexes(db).catch((error) => {
    globalForMongo.__mongoIndexes = undefined
    console.error('[mongo] 인덱스 확인 실패', redactApiKeys(String(error?.message ?? error)))
  })
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
    itemSheets: db.collection<ItemSheetDoc>('itemSheets'),
    itemRows: db.collection<ItemRowDoc>('itemRows'),
    itemLogs: db.collection<LegacyItemLogDoc>('itemLogs'),
    enhanceEvents: db.collection<EnhanceEventDoc>('enhanceEvents'),
    historySync: db.collection<HistorySyncDoc>('historySync'),
    ledgerSettings: db.collection<LedgerSettingsDoc>('ledgerSettings'),
    guideSettings: db.collection<GuideSettingsDoc>('guideSettings'),
    appSettings: db.collection<AppSettingsDoc>('appSettings'),
    hunts: db.collection<HuntDoc>('hunts'),
    dropSales: db.collection<DropSaleDoc>('dropSales'),
    mesoEntries: db.collection<MesoEntryDoc>('mesoEntries'),
    bossRosters: db.collection<BossRosterDoc>('bossRosters'),
    bossRosterWeeks: db.collection<BossRosterWeekDoc>('bossRosterWeeks'),
    bossClears: db.collection<BossClearDoc>('bossClears'),
    itemIcons: db.collection<ItemIconDoc>('itemIcons'),
    cache: db.collection<CacheDoc>('cache'),
    rateLimits: db.collection<RateLimitDoc>('rateLimits'),
    sundays: db.collection<SundayDoc>('sundays'),
    memos: db.collection<MemoDoc>('memos'),
  }
}

export async function withCache<T>(key: string, ttlMs: number, load: () => Promise<T>, fresh = false): Promise<T> {
  const { cache } = await useCollections()
  const hit = fresh ? null : await cache.findOne({ _id: key, expireAt: { $gt: new Date() } })
  if (hit) return hit.data as T
  const data = await load()
  await cache.updateOne({ _id: key }, { $set: { data, expireAt: new Date(Date.now() + ttlMs) } }, { upsert: true })
  return data
}
