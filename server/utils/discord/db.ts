import type { Db, ObjectId } from 'mongodb'
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

const globalForBot = globalThis as typeof globalThis & { __botIndexes?: Promise<void> }

async function ensureIndexes(db: Db) {
  await db.collection('parties').createIndexes([
    { key: { channelId: 1 }, unique: true },
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
  }
}
