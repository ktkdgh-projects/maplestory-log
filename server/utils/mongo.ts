import { MongoClient, type Db, type ObjectId } from 'mongodb'
import type { BossLoot, BossRosterCharacter, DropSaleInput, MesoEntryInput, EnhanceKind, HuntInput, ItemIcon, ItemPurchase, KeyStatus } from '#shared/types'

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
  // 스타포스 MVP 할인율(0~0.1). 강화 기록 비용·계산기에 쓴다
  mvpDiscount?: number
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
  // 닉네임을 바꾸기 전 이름들. 넥슨 강화 기록엔 그때 이름만 남아서, 예전 기록을 이어 찾는 데 쓴다
  pastNames?: string[]
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
  // 성장 기록 캐릭터 칸 순서. 끌어서 바꾸기 전엔 없다
  order?: number
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

export interface MemoDoc {
  _id: ObjectId
  userId: ObjectId
  title: string
  body: string
  createdAt: Date
  updatedAt: Date
}

export interface ItemSheetDoc {
  _id: ObjectId
  userId: ObjectId
  title: string
  ocid: string | null
  characterName: string | null
  excluded?: boolean
  order: number
  createdAt: Date
}

export interface ItemRowDoc {
  _id: ObjectId
  userId: ObjectId
  sheetId: ObjectId
  part: string
  name: string
  icon: string | null
  buy: number
  sell: number
  // 경매장 수수료율. 내 정보 MVP가 실버 이상이면 읽을 때 3%로 본다
  sellFee?: number
  memo: string | null
  buyDate?: string | null
  purchases?: ItemPurchase[]
  sellDate?: string | null
  level?: number | null
  excluded?: boolean
  starforce?: number
  starforceDate?: string | null
  potential?: number
  potentialDate?: string | null
  // 강화 비용을 날짜별로 나눠 적은 내역. 있으면 금액은 그 합계, 날짜는 가장 늦은 날이다
  starforceEntries?: ItemPurchase[]
  potentialEntries?: ItemPurchase[]
  order: number
}

// 예전 방식(금액을 고친 날 기준) 장비 결산 기록. 지금은 구매일·판매일로 계산해서 더 쓰지 않고 탈퇴 때만 지운다
interface LegacyItemLogDoc {
  userId: ObjectId
}

export interface EnhanceEventDoc {
  userId: ObjectId
  eventId: string
  kind: EnhanceKind
  character: string
  item: string
  at: Date
  success: boolean
  destroyed: boolean
  beforeStar: number | null
  afterStar: number | null
  tool: string | null
  grade: string | null
  options: string[]
  addOptions: string[]
  // 쓴 메소 계산용. 이 필드가 생기기 전에 받은 기록은 다시 받으며 채운다
  itemLevel?: number | null
  // 재설정 비용은 재설정 전 등급 기준이다
  beforeGrade?: string | null
  protect?: boolean
  superior?: boolean
  // 주문서로 강화해 메소를 안 쓴 기록
  scroll?: boolean
  // 이벤트 비용 할인율 0~1
  eventDiscount?: number
}

export interface HistorySyncDoc {
  // 사용자 id
  _id: ObjectId
  // 어제부터 거꾸로 모으며, 여기까지(포함) 모았다는 가장 이른 날
  oldest: string | null
  // 가장 최근에 모은 지난날. 다음엔 이 다음 날부터 어제까지 모으고, 오늘은 매번 따로 다시 받는다
  newest: string | null
  done: boolean
  todayAt?: Date | null
  lockedAt: Date | null
  // 받는 필드가 늘면 올려서 처음부터 다시 받게 한다
  version?: number
}

// 사이트 전체 설정. _id 'collection' 하나만 쓴다
export interface AppSettingsDoc {
  _id: string
  paused: boolean
  pausedAt: Date | null
  updatedAt: Date
}

export interface LedgerSettingsDoc {
  // 사용자 id
  _id: ObjectId
  feeRate: number
  balanceDate: string | null
  balance: number | null
  updatedAt: Date
}

export interface HuntDoc extends HuntInput {
  _id: ObjectId
  userId: ObjectId
  createdAt: Date
}

export interface DropSaleDoc extends DropSaleInput {
  _id: ObjectId
  userId: ObjectId
  createdAt: Date
}

export interface MesoEntryDoc extends MesoEntryInput {
  _id: ObjectId
  userId: ObjectId
  createdAt: Date
}

export interface BossRosterDoc {
  _id: ObjectId
  userId: ObjectId
  characters: BossRosterCharacter[]
  updatedAt: Date
}

export interface BossClearDoc {
  _id: ObjectId
  userId: ObjectId
  ocid: string
  name: string
  // 주간 보스는 그 주 목요일, 월간 보스는 그 달 1일. 같은 기간에 한 번만 잡을 수 있게 묶는 값
  period: string
  bossId: string
  difficulty: string
  party: number
  date: string
  // 잡은 날의 가격을 남겨 두어야 나중에 가격이 바뀌어도 그때 번 돈이 그대로 남는다
  meso: number
  loot?: BossLoot[]
  createdAt: Date
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

// 넥슨 API에서 본 아이템 이름 → 아이콘. 직접 추가한 장비 결산 줄에 아이콘을 붙일 때 쓴다
interface ItemIconDoc {
  _id: string
  icon: string
  kind: ItemIcon['kind']
  part?: string
  // 장비 착용 레벨. 지금 안 낀 장비의 스타포스 비용을 계산할 때 쓴다
  level?: number
  updatedAt: Date
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

// 넥슨 이벤트 공지는 진행 중인 것만 와서, 지난 썬데이 메이플을 보여주려고 처음 본 공지를 남겨 둔다
export interface SundayDoc {
  _id: number
  title: string
  url: string
  image: string | null
  start: Date
  end: Date
  publishedAt: Date
  effects?: string[]
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
    console.error('[mongo] 인덱스 확인 실패', error)
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
    appSettings: db.collection<AppSettingsDoc>('appSettings'),
    hunts: db.collection<HuntDoc>('hunts'),
    dropSales: db.collection<DropSaleDoc>('dropSales'),
    mesoEntries: db.collection<MesoEntryDoc>('mesoEntries'),
    bossRosters: db.collection<BossRosterDoc>('bossRosters'),
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
