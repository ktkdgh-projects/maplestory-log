import type { H3Event } from 'h3'
import type { ObjectId } from 'mongodb'
import type { UserDoc } from './mongo'

// 넥슨 호출에 쓸 사용자 키는 반드시 여기서만 꺼낸다. 프렌즈 승인 후 Open ID 토큰으로 바꿀 자리
export async function getUserApiKey(userId: ObjectId): Promise<string> {
  const { users } = await useCollections()
  const user = await users.findOne({ _id: userId }, { projection: { keyEnc: 1, keyStatus: 1 } })
  if (!user?.keyEnc || user.keyStatus === 'invalid' || user.keyStatus === 'deleted') {
    throw createError({ statusCode: 409, message: '등록된 키가 작동하지 않아요. 내 정보에서 새 키를 등록해 주세요.' })
  }
  return decryptApiKey(user.keyEnc)
}

// 서버 키 하루 호출 한도를 여러 IP가 나눠 다 써 버리지 않게, 로그인 없는 검색은 전체를 합쳐 하루 이만큼만 받는다
const ANONYMOUS_DAILY_LIMIT = 3000

async function countAnonymousSearch() {
  const today = kstToday()
  const { rateLimits } = await useCollections()
  const doc = await rateLimits.findOneAndUpdate(
    { _id: `anonymous-search:${today}` },
    { $inc: { count: 1 }, $setOnInsert: { expireAt: kstDayStart(addDays(today, 2)) } },
    { upsert: true, returnDocument: 'after' },
  )
  if ((doc?.count ?? 0) > ANONYMOUS_DAILY_LIMIT) {
    throw createError({ statusCode: 429, message: '오늘 검색이 많아 잠시 쉬어요. 로그인하면 계속 쓸 수 있어요.' })
  }
}

// 로그인 전엔 서버 키를 IP당·하루 전체 횟수를 제한해서 쓴다
export async function searchApiKey(event: H3Event, bucket: string): Promise<string> {
  const user = event.context.user
  if (user) return getUserApiKey(user._id)
  const apiKey = useRuntimeConfig().nexonApiKey
  if (!apiKey) throw createError({ statusCode: 503, message: '지금은 로그인 없이 검색할 수 없어요.' })
  await rateLimit(event, bucket, 30, 60)
  await countAnonymousSearch()
  return apiKey
}

// 뒤에서 도는 수집이 쓰기 전에 확인한다. 도중에 탈퇴했으면 지운 데이터를 다시 만들지 않게
export async function userExists(userId: ObjectId): Promise<boolean> {
  const { users } = await useCollections()
  return !!(await users.findOne({ _id: userId }, { projection: { _id: 1 } }))
}

export async function markKeyStatus(userId: ObjectId, status: UserDoc['keyStatus'], reason: string | null) {
  const { users } = await useCollections()
  await users.updateOne({ _id: userId }, { $set: { keyStatus: status, keyStatusReason: reason, keyCheckedAt: new Date() } })
}

export function assertSameKey(user: UserDoc, apiKey: unknown) {
  if (typeof apiKey !== 'string' || !user.keyHash || hashApiKey(apiKey.trim()) !== user.keyHash) {
    throw createError({ statusCode: 403, message: '입력한 키가 등록된 키와 달라요.' })
  }
}

export function readApiKey(value: unknown): string {
  const apiKey = typeof value === 'string' ? value.trim() : ''
  if (apiKey.length < 20 || apiKey.length > 200 || /\s/.test(apiKey)) {
    throw createError({ statusCode: 400, message: 'API 키 형식이 올바르지 않아요.' })
  }
  return apiKey
}
