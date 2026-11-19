import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { ObjectId } from 'mongodb'
import type { H3Event } from 'h3'
import { useBotCollections } from './db'

// 레다봇 웹 화면은 메이플로그 로그인과 따로, 디스코드 로그인으로 누구인지 확인한다
const SESSION_COOKIE = 'leda_session'
const STATE_COOKIE = 'leda_oauth'
const DAY_MS = 24 * 60 * 60 * 1000
const SESSION_MS = 30 * DAY_MS
// 쓸 때마다 다시 늘리되, 하루에 한 번만 쿠키를 새로 굽는다
const SESSION_REFRESH_MS = DAY_MS
const STATE_MS = 10 * 60 * 1000
const DISCORD_API = 'https://discord.com/api/v10'
const DISCORD_AUTHORIZE = 'https://discord.com/oauth2/authorize'
// 로그인 뒤 돌아갈 수 있는 곳은 레다봇 화면뿐이다
const NEXT_PATTERN = /^\/party\/(time|lead|split)\?p=[0-9a-f]{24}$/

// 봇 토큰으로 서명한다. 토큰을 새로 발급하면 예전 로그인은 모두 풀린다
function signature(kind: string, payload: string): Buffer {
  return createHmac('sha256', useRuntimeConfig().discordBotToken).update(`${kind}:${payload}`).digest()
}
function seal(kind: string, data: object, ttlMs: number): string {
  const payload = Buffer.from(JSON.stringify({ ...data, exp: Date.now() + ttlMs })).toString('base64url')
  return `${payload}.${signature(kind, payload).toString('base64url')}`
}
function unseal<T>(kind: string, token: string | undefined): (T & { exp: number }) | null {
  const [payload, sig] = token?.split('.') ?? []
  if (!payload || !sig || !useRuntimeConfig().discordBotToken) return null
  const given = Buffer.from(sig, 'base64url')
  const expected = signature(kind, payload)
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as T & { exp: number }
  return data.exp > Date.now() ? data : null
}

const cookieOptions = (maxAgeMs: number) => ({ httpOnly: true, secure: !import.meta.dev, sameSite: 'lax' as const, path: '/', maxAge: maxAgeMs / 1000 })

// 채널 메시지에 넣는 화면 주소의 앞부분. 정해진 시각에 올리는 메시지는 요청이 없으므로 설정값이 꼭 있어야 한다
export function botSiteUrl(event?: H3Event): string {
  const { discordSiteUrl } = useRuntimeConfig()
  if (discordSiteUrl) return discordSiteUrl.replace(/\/$/, '')
  return event ? getRequestURL(event, { xForwardedHost: true, xForwardedProto: true }).origin : ''
}
export const botPageUrl = (page: 'time' | 'lead' | 'split', partyId: ObjectId, event?: H3Event) => `${botSiteUrl(event)}/party/${page}?p=${partyId.toHexString()}`

// 화면과 API를 부른 사람의 디스코드 id. 로그인하지 않았으면 401
export function requireBotUser(event: H3Event): string {
  const session = unseal<{ userId: string }>('session', getCookie(event, SESSION_COOKIE))
  if (!session) throw createError({ statusCode: 401, message: '디스코드 로그인이 필요해요.' })
  if (session.exp - Date.now() < SESSION_MS - SESSION_REFRESH_MS) setCookie(event, SESSION_COOKIE, seal('session', { userId: session.userId }, SESSION_MS), cookieOptions(SESSION_MS))
  return session.userId
}

// 로그인한 사람이 지금 그 파티의 파티원일 때만 파티를 돌려준다
export async function partyOfBotUser(event: H3Event, partyId: unknown) {
  const userId = requireBotUser(event)
  const { parties } = await useBotCollections()
  const party = typeof partyId === 'string' && ObjectId.isValid(partyId) ? await parties.findOne({ '_id': new ObjectId(partyId), 'members.userId': userId }) : null
  if (!party) throw createError({ statusCode: 403, message: '이 파티 명단에 없어요. 파티장에게 명단 새로고침을 부탁해 주세요.' })
  return { party, userId }
}

// 디스코드 승인 화면으로 보낼 주소. 돌아왔을 때 같은 브라우저인지 확인하려고 쿠키에 표시를 남긴다
export function startBotLogin(event: H3Event, next: unknown): string {
  if (typeof next !== 'string' || !NEXT_PATTERN.test(next)) throw createError({ statusCode: 400, message: '디스코드에서 버튼을 다시 눌러 주세요.' })
  const nonce = randomBytes(16).toString('hex')
  setCookie(event, STATE_COOKIE, nonce, cookieOptions(STATE_MS))
  const query = new URLSearchParams({
    client_id: useRuntimeConfig().discordAppId,
    response_type: 'code',
    scope: 'identify',
    redirect_uri: `${botSiteUrl(event)}/api/discord/callback`,
    state: seal('state', { next, nonce }, STATE_MS),
    // 이미 승인한 사람은 화면 없이 바로 돌아온다
    prompt: 'none',
  })
  return `${DISCORD_AUTHORIZE}?${query}`
}

// 디스코드에서 돌아온 코드를 사람 id로 바꾸고 로그인 쿠키를 굽는다. 돌아갈 화면 주소를 돌려준다
export async function finishBotLogin(event: H3Event): Promise<string> {
  const failed = () => createError({ statusCode: 400, message: '디스코드 로그인을 마치지 못했어요. 디스코드에서 버튼을 다시 눌러 주세요.' })
  const { code, state: sealed } = getQuery(event)
  const state = unseal<{ next: string, nonce: string }>('state', typeof sealed === 'string' ? sealed : undefined)
  const nonce = getCookie(event, STATE_COOKIE)
  deleteCookie(event, STATE_COOKIE, { path: '/' })
  if (typeof code !== 'string' || !state || !nonce || state.nonce !== nonce) throw failed()

  const { discordAppId, discordClientSecret, discordApiBase } = useRuntimeConfig()
  const base = discordApiBase || DISCORD_API
  const token = await fetch(`${base}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: discordAppId, client_secret: discordClientSecret, grant_type: 'authorization_code', code, redirect_uri: `${botSiteUrl(event)}/api/discord/callback` }),
  }).then(res => (res.ok ? res.json() as Promise<{ access_token?: string }> : null), () => null)
  if (!token?.access_token) throw failed()
  const me = await fetch(`${base}/users/@me`, { headers: { Authorization: `Bearer ${token.access_token}` } }).then(res => (res.ok ? res.json() as Promise<{ id?: string }> : null), () => null)
  if (!me?.id) throw failed()

  setCookie(event, SESSION_COOKIE, seal('session', { userId: me.id }, SESSION_MS), cookieOptions(SESSION_MS))
  return state.next
}
