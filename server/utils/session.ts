import type { H3Event } from 'h3'
import type { ObjectId } from 'mongodb'
import type { SessionDoc, UserDoc } from './mongo'

const COOKIE_NAME = 'ml_session'
const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
const REMEMBER_MS = 90 * DAY_MS
const SHORT_SESSION_MS = 12 * HOUR_MS
const ROTATE_AFTER_MS = 7 * DAY_MS
// 토큰 교체 직후 같은 페이지에서 동시에 나간 요청이 옛 토큰으로 끊기지 않게 잠시 허용
const ROTATE_GRACE_MS = 60 * 1000
const TOUCH_INTERVAL_MS = HOUR_MS

declare module 'h3' {
  interface H3EventContext {
    user?: UserDoc
    session?: SessionDoc
  }
}

function setSessionCookie(event: H3Event, token: string, remember: boolean) {
  setCookie(event, COOKIE_NAME, token, {
    httpOnly: true,
    secure: !import.meta.dev,
    sameSite: 'lax',
    path: '/',
    maxAge: remember ? REMEMBER_MS / 1000 : undefined,
  })
}

export function clearSessionCookie(event: H3Event) {
  deleteCookie(event, COOKIE_NAME, { path: '/' })
}

// 순서가 중요하다: Edge·Whale UA에도 Chrome이, Android UA에도 Linux가 들어 있다
const BROWSERS: [RegExp, string][] = [[/Edg\//, 'Edge'], [/Whale\//, 'Whale'], [/Chrome\//, 'Chrome'], [/Firefox\//, 'Firefox'], [/Safari\//, 'Safari']]
const SYSTEMS: [RegExp, string][] = [[/Windows/, 'Windows'], [/Android/, 'Android'], [/iPhone|iPad/, 'iOS'], [/Mac OS X/, 'macOS'], [/Linux/, 'Linux']]

function describeDevice(userAgent = ''): string {
  const browser = BROWSERS.find(([pattern]) => pattern.test(userAgent))?.[1] ?? '브라우저'
  const os = SYSTEMS.find(([pattern]) => pattern.test(userAgent))?.[1] ?? '알 수 없는 기기'
  return `${browser} · ${os}`
}

export async function createSession(event: H3Event, userId: ObjectId, remember: boolean) {
  const { sessions } = await useCollections()
  const token = randomToken()
  const now = new Date()
  await sessions.insertOne({
    tokenHash: sha256(token),
    prevTokenHash: null,
    prevValidUntil: null,
    userId,
    device: describeDevice(getHeader(event, 'user-agent')),
    remember,
    createdAt: now,
    lastUsedAt: now,
    rotatedAt: now,
    expiresAt: new Date(now.getTime() + (remember ? REMEMBER_MS : SHORT_SESSION_MS)),
  } as SessionDoc)
  setSessionCookie(event, token, remember)
}

export async function loadSession(event: H3Event) {
  const token = getCookie(event, COOKIE_NAME)
  if (!token) return

  const { sessions, users } = await useCollections()
  const tokenHash = sha256(token)
  const now = new Date()
  const session = await sessions.findOne({
    $or: [{ tokenHash }, { prevTokenHash: tokenHash, prevValidUntil: { $gt: now } }],
    expiresAt: { $gt: now },
  })
  if (!session) {
    clearSessionCookie(event)
    return
  }

  const user = await users.findOne({ _id: session.userId })
  if (!user) {
    await sessions.deleteOne({ _id: session._id })
    clearSessionCookie(event)
    return
  }

  if (session.tokenHash === tokenHash && session.remember && now.getTime() - session.rotatedAt.getTime() > ROTATE_AFTER_MS) {
    const nextToken = randomToken()
    await sessions.updateOne({ _id: session._id }, {
      $set: {
        tokenHash: sha256(nextToken),
        prevTokenHash: tokenHash,
        prevValidUntil: new Date(now.getTime() + ROTATE_GRACE_MS),
        rotatedAt: now,
        lastUsedAt: now,
        expiresAt: new Date(now.getTime() + REMEMBER_MS),
      },
    })
    setSessionCookie(event, nextToken, true)
  }
  else if (now.getTime() - session.lastUsedAt.getTime() > TOUCH_INTERVAL_MS) {
    await sessions.updateOne({ _id: session._id }, {
      $set: {
        lastUsedAt: now,
        ...(session.remember && { expiresAt: new Date(now.getTime() + REMEMBER_MS) }),
      },
    })
    await users.updateOne({ _id: user._id }, { $set: { lastSeenAt: now } })
  }

  event.context.session = session
  event.context.user = user
}

export function requireUser(event: H3Event): UserDoc {
  const user = event.context.user
  if (!user) throw createError({ statusCode: 401, message: '로그인이 필요해요.' })
  return user
}

export async function revokeSessions(userId: ObjectId, options: { exceptId?: ObjectId } = {}) {
  const { sessions } = await useCollections()
  await sessions.deleteMany({ userId, ...(options.exceptId && { _id: { $ne: options.exceptId } }) })
}
