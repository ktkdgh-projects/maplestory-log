import type { CharacterBrief } from './character'

export type KeyStatus = 'valid' | 'invalid' | 'rate_limited' | 'deleted'

export interface MeResponse {
  user: {
    keyLast4: string | null
    keyStatus: KeyStatus
    keyCheckedAt: string | null
    consentAt: string
    createdAt: string
    main: (CharacterBrief & { imageUrl: string | null }) | null
    isAdmin: boolean
    // 스타포스 MVP 할인율(0~0.1)
    mvpDiscount: number
  } | null
}

export interface AdminOverview {
  users: { total: number, active30d: number, byKeyStatus: Record<KeyStatus, number> }
  jobs: { pending: number, running: number, failed: number }
  today: { ok: number, empty: number, failed: number }
  // 수집 로그. 사용자는 id 끝 6자리로만 보여준다 (키는 처음부터 남기지 않는다)
  logs: { at: string, user: string, ocid: string, date: string, result: string, ms: number }[]
  paused: boolean
  pausedAt: string | null
}

export interface SessionInfo {
  id: string
  device: string
  remember: boolean
  createdAt: string
  lastUsedAt: string
  current: boolean
}
