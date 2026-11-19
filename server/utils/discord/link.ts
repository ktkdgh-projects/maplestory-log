import { createHmac, timingSafeEqual } from 'node:crypto'

export interface PartyLink {
  userId: string
  partyId: string
  week: string
}

const LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000

// 봇 토큰으로 서명한다. 토큰을 새로 발급하면 예전 링크는 모두 못 쓰게 된다
function linkSignature(payload: string): Buffer {
  return createHmac('sha256', useRuntimeConfig().discordBotToken).update(`party-link:${payload}`).digest()
}

// 디스코드 버튼을 누른 사람에게만 주는 개인 링크 토큰. 웹 화면은 이 토큰으로만 사람을 확인한다
export function signPartyLink(link: PartyLink): string {
  const payload = Buffer.from(JSON.stringify({ ...link, exp: Date.now() + LINK_TTL_MS })).toString('base64url')
  return `${payload}.${linkSignature(payload).toString('base64url')}`
}

export function readPartyLink(token: unknown): PartyLink {
  const expired = () => createError({ statusCode: 401, message: '링크가 만료됐어요. 디스코드에서 버튼을 다시 눌러 주세요.' })
  if (typeof token !== 'string' || !useRuntimeConfig().discordBotToken) throw expired()
  const [payload, sig] = token.split('.')
  if (!payload || !sig) throw expired()
  const given = Buffer.from(sig, 'base64url')
  const expected = linkSignature(payload)
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw expired()
  const { exp, ...link } = JSON.parse(Buffer.from(payload, 'base64url').toString()) as PartyLink & { exp: number }
  if (exp < Date.now()) throw expired()
  return link
}
