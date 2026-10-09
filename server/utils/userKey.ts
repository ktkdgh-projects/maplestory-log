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

export async function markKeyStatus(userId: ObjectId, status: UserDoc['keyStatus'], reason: string | null) {
  const { users } = await useCollections()
  await users.updateOne({ _id: userId }, { $set: { keyStatus: status, keyStatusReason: reason, keyCheckedAt: new Date() } })
}

// 키 재입력이 필요한 작업(탈퇴, 키 삭제)에서 입력한 키가 등록된 키와 같은지 확인
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
