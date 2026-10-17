// 컬렉션마다 저장되는 문서 모양. 연결·인덱스·컬렉션 목록은 mongo.ts
import type { ObjectId } from 'mongodb'
import type { BossLoot, BossRosterCharacter, DropSaleInput, MesoEntryInput, EnhanceKind, HuntInput, ItemIcon, ItemPurchase, KeyStatus } from '#shared/types'
import type { MeisterProgress } from '#shared/calc/meister'
import type { JobTraits } from '#shared/data/jobTraits'

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
  // 등급을 바꾼 이력. 강화 비용은 기록 시각의 할인으로 센다
  mvpHistory?: { from: Date, rate: number }[]
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

export interface UserCharacterDoc {
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
  // 끌어서 정한 순서. 없으면 만든 순서(최신 위)로 둔다
  order?: number
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
  // 경매장 수수료율. 판매가를 처음 적을 때의 MVP로 정해 두고, 나중에 등급이 바뀌어도 그대로 쓴다
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
export interface LegacyItemLogDoc {
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

// 공략 페이지에서 고친 값. 사용자마다 한 문서
export interface GuideSettingsDoc {
  _id: ObjectId
  meister?: MeisterProgress
  // 직업 이름 → 고친 특성
  jobTraits?: Record<string, Partial<JobTraits>>
  updatedAt: Date
}

export interface LedgerSettingsDoc {
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

export interface JobLogDoc {
  at: Date
  userId: ObjectId
  ocid: string
  date: string
  result: string
  ms: number
}

// 넥슨 API에서 본 아이템 이름 → 아이콘. 직접 추가한 장비 결산 줄에 아이콘을 붙일 때 쓴다
export interface ItemIconDoc {
  _id: string
  icon: string
  kind: ItemIcon['kind']
  part?: string
  // 장비 착용 레벨. 지금 안 낀 장비의 스타포스 비용을 계산할 때 쓴다
  level?: number
  updatedAt: Date
}

export interface CacheDoc {
  _id: string
  data: unknown
  expireAt: Date
}

export interface RateLimitDoc {
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
