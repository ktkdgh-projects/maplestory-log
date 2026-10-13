import type { H3Event } from 'h3'

// 넥슨 API를 부르는 쓰기 요청(장비 불러오기·시트 만들기·대표 캐릭터)의 1분 한도
export const NEXON_RATE_LIMIT = 20

// Vercel이 직접 채우는 헤더를 먼저 본다. X-Forwarded-For 첫 값은 다른 프록시 뒤에선 사용자가 꾸밀 수 있다
function clientIp(event: H3Event): string {
  const vercel = getHeader(event, 'x-vercel-forwarded-for') ?? getHeader(event, 'x-real-ip')
  return vercel?.split(',')[0]?.trim() || getRequestIP(event, { xForwardedFor: true }) || 'unknown'
}

// 서버리스 인스턴스끼리 메모리를 공유하지 않으므로 횟수는 DB에 센다
export async function rateLimit(event: H3Event, bucket: string, limit: number, windowSec: number) {
  const ip = clientIp(event)
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
