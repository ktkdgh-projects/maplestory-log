import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

export const KEY_VERSION = 1
// 짧게 잘린 인증 태그를 받아 주지 않도록 길이를 못박는다
const AUTH_TAG_LENGTH = 16
const API_KEY_PATTERN = /\b(?:test|live)_[0-9a-f]{32,}\b/gi

function toKey(secret: string, name: string): Buffer {
  const key = Buffer.from(secret, 'base64')
  if (key.length !== 32) throw new Error(`${name}은 base64로 인코딩한 32바이트여야 합니다`)
  return key
}
const encryptionKey = () => toKey(useRuntimeConfig().keyEncSecret, 'NUXT_KEY_ENC_SECRET')

export function encryptApiKey(apiKey: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv, { authTagLength: AUTH_TAG_LENGTH })
  const data = Buffer.concat([cipher.update(apiKey, 'utf8'), cipher.final()])
  return {
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: data.toString('base64'),
  }
}

function decryptWith(key: Buffer, enc: { iv: string, tag: string, data: string }): string {
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(enc.iv, 'base64'), { authTagLength: AUTH_TAG_LENGTH })
  decipher.setAuthTag(Buffer.from(enc.tag, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(enc.data, 'base64')), decipher.final()]).toString('utf8')
}

// 시크릿을 바꾸는 동안엔 예전 시크릿으로도 풀어 본다. stale이면 새 시크릿으로 다시 저장해야 한다
export function decryptApiKey(enc: { iv: string, tag: string, data: string }): { apiKey: string, stale: boolean } {
  try {
    return { apiKey: decryptWith(encryptionKey(), enc), stale: false }
  }
  catch (error) {
    const prev = useRuntimeConfig().keyEncSecretPrev
    if (!prev) throw error
    return { apiKey: decryptWith(toKey(prev, 'NUXT_KEY_ENC_SECRET_PREV'), enc), stale: true }
  }
}

export function hashApiKey(apiKey: string): string {
  const secret = useRuntimeConfig().keyHashSecret
  if (!secret) throw new Error('NUXT_KEY_HASH_SECRET이 설정되지 않았습니다')
  return createHmac('sha256', secret).update(apiKey).digest('hex')
}

// 해시 비교에 걸린 시간으로 값을 짐작하지 못하게 한다
export function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function randomToken(): string {
  return randomBytes(32).toString('base64url')
}

export function redactApiKeys(text: string): string {
  return text.replace(API_KEY_PATTERN, '[API_KEY]')
}
