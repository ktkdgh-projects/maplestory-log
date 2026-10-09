import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto'

export const KEY_VERSION = 1
const API_KEY_PATTERN = /\b(?:test|live)_[0-9a-f]{32,}\b/gi

function encryptionKey(): Buffer {
  const key = Buffer.from(useRuntimeConfig().keyEncSecret, 'base64')
  if (key.length !== 32) throw new Error('NUXT_KEY_ENC_SECRET은 base64로 인코딩한 32바이트여야 합니다')
  return key
}

export function encryptApiKey(apiKey: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const data = Buffer.concat([cipher.update(apiKey, 'utf8'), cipher.final()])
  return {
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: data.toString('base64'),
  }
}

export function decryptApiKey(enc: { iv: string, tag: string, data: string }): string {
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(enc.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(enc.tag, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(enc.data, 'base64')), decipher.final()]).toString('utf8')
}

export function hashApiKey(apiKey: string): string {
  const secret = useRuntimeConfig().keyHashSecret
  if (!secret) throw new Error('NUXT_KEY_HASH_SECRET이 설정되지 않았습니다')
  return createHmac('sha256', secret).update(apiKey).digest('hex')
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
