import type { Db, ObjectId } from 'mongodb'
import type { PartyWeekPhase, PartyWeekStep } from '#shared/types'
import { getMongoClient } from '../mongo'

// 레다봇 데이터는 메이플로그 DB와 섞이지 않게 같은 클러스터의 다른 데이터베이스에 둔다
const BOT_DB_NAME = 'leda'

export interface PartyMember {
  userId: string
  character: string
  joinedAt: Date
}

export interface PartyDoc {
  _id: ObjectId
  guildId: string
  channelId: string
  name: string
  leaderId: string
  members: PartyMember[]
  createdAt: Date
  updatedAt: Date
}

// 사람의 시간은 하나라서 파티가 아니라 사람 + 주로 저장한다. slots는 요일(목=0)×12 + 2시간 칸 번호
interface AvailabilityDoc {
  _id: ObjectId
  userId: string
  week: string
  slots: number[]
  updatedAt: Date
}

// 한 주가 지나가는 단계. 정해진 시각에 차례로 돌고, 파티장이 손으로 먼저 돌릴 수도 있다
export type WeekStep = PartyWeekStep

// missing은 그 시간이 안 되는 제출자 수(0이면 모두 가능)
export interface WeekCandidate { slot: number, missing: number }

interface WeekChange {
  requesterId: string
  reason: string
  options: number[]
  // 후보 칸 → 가능하다고 누른 사람
  ok: Record<string, string[]>
  messageId: string | null
}

export interface WeekDoc {
  _id: ObjectId
  partyId: ObjectId
  week: string
  phase: PartyWeekPhase
  candidates: WeekCandidate[]
  // 사람 → 고른 후보 칸
  votes: Record<string, number>
  voteMessageId: string | null
  confirmed: number | null
  done: Partial<Record<WeekStep, Date>>
  // 그 주만 다르게 잡은 일정: 단계 시각을 바꾸고, fromDay(목=0)부터의 요일만 받는다
  custom: { steps: Partial<Record<WeekStep, Date>>, fromDay: number } | null
  change: WeekChange | null
  updatedAt: Date
}

interface SplitDoc {
  _id: ObjectId
  partyId: ObjectId
  sale: number
  cost: number
  sellerId: string
  payerId: string
  feeRate: number
  memberIds: string[]
  createdBy: string
  createdAt: Date
}

interface BotRateLimitDoc {
  _id: string
  count: number
  expireAt: Date
}

const globalForBot = globalThis as typeof globalThis & { __botIndexes?: Promise<void> }

async function ensureIndexes(db: Db) {
  await Promise.all([
    db.collection('parties').createIndexes([
      { key: { channelId: 1 }, unique: true },
    ]),
    db.collection('availability').createIndexes([
      { key: { userId: 1, week: 1 }, unique: true },
    ]),
    db.collection('weeks').createIndexes([
      { key: { partyId: 1, week: 1 }, unique: true },
    ]),
    db.collection('rateLimits').createIndexes([
      { key: { expireAt: 1 }, expireAfterSeconds: 0 },
    ]),
  ])
}

export async function useBotCollections() {
  const db = (await getMongoClient()).db(BOT_DB_NAME)
  globalForBot.__botIndexes ??= ensureIndexes(db).catch((error) => {
    globalForBot.__botIndexes = undefined
    console.error('[leda] 인덱스 확인 실패', String(error?.message ?? error))
  })
  return {
    parties: db.collection<PartyDoc>('parties'),
    availability: db.collection<AvailabilityDoc>('availability'),
    weeks: db.collection<WeekDoc>('weeks'),
    splits: db.collection<SplitDoc>('splits'),
    rateLimits: db.collection<BotRateLimitDoc>('rateLimits'),
  }
}

// 개인 링크가 새도 마구 두드리지 못하게 사람마다 센다
export async function botRateLimit(bucket: string, userId: string, limit: number, windowSec: number) {
  const windowStart = Math.floor(Date.now() / 1000 / windowSec) * windowSec
  const { rateLimits } = await useBotCollections()
  const doc = await rateLimits.findOneAndUpdate(
    { _id: `${bucket}:${userId}:${windowStart}` },
    { $inc: { count: 1 }, $setOnInsert: { expireAt: new Date((windowStart + windowSec) * 1000) } },
    { upsert: true, returnDocument: 'after' },
  )
  if ((doc?.count ?? 0) > limit) throw createError({ statusCode: 429, message: '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.' })
}
