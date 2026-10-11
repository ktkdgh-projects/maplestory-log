import type { CharacterBrief } from './character'
import type { PotentialTier, StarforceRestore } from './enhance'

// 전체 캐릭터로 볼 때 같은 이름 장비를 가르는 주인
export interface ReviewOwner { ocid: string, name: string }

// 강화 결산: 고른 기간에 한 장비의 스타포스. 시작 ★은 첫 시도 전, 끝 ★은 마지막 시도 뒤
export interface ReviewStarforce {
  character: ReviewOwner
  item: string
  slot: string | null
  icon: string | null
  level: number | null
  from: number
  to: number
  attempts: number
  destroys: number
  // 누른 비용(MVP·이벤트 할인·파괴방지 포함)과 파괴 뒤 복구 메소, 복구에 든 노작
  meso: number
  restoreMeso: number
  copies: number
  // 계산기 조건: 파괴방지를 쓴 ★, 이벤트 할인을 받았는지, 그 기간 썬데이 스타포스 효과
  protectStars: number[]
  discount: boolean
  sundayEffects: string[]
  // 이 기록 때의 MVP 할인율. 기대값도 같은 할인으로 센다
  mvp: number
  // 기간에 썬데이·할인 이벤트와 평소가 섞여 같은 장비를 조건별로 나눴으면 그 조건 이름(썬데이 10/5~ 등), 안 나눴으면 null
  condition?: string | null
  stages: { star: number, attempts: number, success: number, destroy: number }[]
  // 어떻게 올렸나: 시간순으로 ★마다 몇 번 눌러 오르거나 터졌는지. stop은 그 ★에서 멈춤
  path: { star: number, tries: number, result: 'up' | 'destroy' | 'stop', restore: StarforceRestore | null }[]
  first: string
  last: string
  // 장비 결산에 이 기간 날짜로 직접 적은 스타포스 비용
  manual: number | null
}

// 강화 결산: 고른 기간에 한 장비의 윗잠 또는 에디 재설정
export interface ReviewPotential {
  character: ReviewOwner
  item: string
  slot: string | null
  icon: string | null
  level: number | null
  additional: boolean
  // 도구별 횟수(블랙 큐브 22, 메소 재설정 74 …)
  tools: { name: string, count: number }[]
  meso: number
  fromGrade: string | null
  toGrade: string | null
  // 기간 시작 때 그 등급에서 이미 돌린 횟수(천장)
  stackBefore: number
  tiers: PotentialTier[]
  // 마지막 등급이 된 뒤(또는 기간 처음부터) 돌린 횟수와, 지금 옵션이 그중 몇 번째에 떴는지
  optionTries: number
  optionAt: number | null
  optionTime: string | null
  options: string[]
  first: string
  last: string
  manual: number | null
}

export interface ReviewResponse {
  // 전체 캐릭터로 보면 null
  character: CharacterBrief | null
  from: string
  to: string
  starforce: ReviewStarforce[]
  potential: ReviewPotential[]
  // 최근 기록이 있는 날(날짜 칩 점·가까운 날 찾기)
  recordDays: string[]
  // 넥슨 장비 정보를 못 받아 레벨·부위 없이 기록만 묶었으면 true
  equipmentMissing?: boolean
}

export interface SundayLineTotal { meso: number, cube: number, ready: boolean, failed: boolean }
