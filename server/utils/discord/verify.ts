import { createPublicKey, verify } from 'node:crypto'

// 디스코드 공개키(32바이트 원본)를 node가 읽는 SPKI 형식으로 감싸는 고정 머리
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex')

// 디스코드가 보낸 요청인지 서명으로 확인한다. 틀리면 그대로 거절해야 디스코드가 엔드포인트를 받아 준다
export function verifyDiscordSignature(body: string, signature: string, timestamp: string, publicKeyHex: string): boolean {
  try {
    const key = createPublicKey({ key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(publicKeyHex, 'hex')]), format: 'der', type: 'spki' })
    return verify(null, Buffer.from(timestamp + body), key, Buffer.from(signature, 'hex'))
  }
  catch {
    return false
  }
}
