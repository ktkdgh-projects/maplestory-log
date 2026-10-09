import type { H3Event } from 'h3'

// 서버리스 인스턴스끼리 메모리를 공유하지 않으므로 횟수는 DB에 센다
export async function rateLimit(event: H3Event, bucket: string, limit: number, windowSec: number) {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  const windowStart = Math.floor(Date.now() / 1000 / windowSec) * windowSec
  const { rateLimits } = await useCollections()
  const doc = await rateLimits.findOneAndUpdate(
    { _id: `${bucket}:${ip}:${windowStart}` },
    { $inc: { count: 1 }, $setOnInsert: { expireAt: new Date((windowStart + windowSec) * 1000) } },
    { upsert: true, returnDocument: 'after' },
  )
  if ((doc?.count ?? 0) > limit) {
    throw createError({ statusCode: 429, message: '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.' })
  }
}
