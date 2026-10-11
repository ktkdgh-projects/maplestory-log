import type { CharacterBrief } from './character'

export type EnhanceKind = 'starforce' | 'cube' | 'potential'

export interface EnhanceEvent {
  kind: EnhanceKind
  at: string
  success: boolean
  destroyed: boolean
  beforeStar: number | null
  afterStar: number | null
  // 큐브 이름이나 '잠재능력 재설정' 같은 재설정 방식
  tool: string | null
  // 에디셔널(아랫잠)에 쓴 큐브·재설정이면 true
  additional: boolean
  grade: string | null
  options: string[]
  addOptions: string[]
  // 이 시도에 쓴 메소. 잠재 메소 재설정은 공식 비용표, 스타포스는 위키 비용 공식 추정. 큐브·주문서는 null
  meso: number | null
  // 스타포스만: 파괴방지를 썼는지, 이벤트 할인율(0.3 = 30%)
  protect: boolean
  eventDiscount: number
  // 스타포스 파괴 뒤 복구. 다음 시도를 보고 가리므로 아직 모르면 null
  restore: StarforceRestore | null
}

// 흔적 복구(to = 흔적 성급, 노작 1~4개 + 복구 메소)나 12성 복구(to = 12, 노작 1개)
export interface StarforceRestore {
  to: number
  fee: number
  copies: number
}

// 잠재(윗잠)와 에디셔널(아랫잠) 각각 큐브와 메소 재설정 횟수
export interface PotentialCounts {
  cubes: number
  resets: number
}

export interface EnhanceSummary {
  starforce: { attempts: number, success: number, destroy: number, protect: number }
  potential: PotentialCounts
  additional: PotentialCounts
  meso: { starforce: number, potential: number, additional: number }
  first: string | null
  last: string | null
}

export interface EnhanceItem {
  // 지금 낀 장비인지. 안 낀 장비는 기간 안에 기록이 있는 것만 온다
  worn: boolean
  slot: string
  name: string
  icon: string
  level: number | null
  starforce: number
  potentialGrade: string | null
  additionalGrade: string | null
  // 지금 장착한 장비의 잠재·에디 옵션
  potentials: string[]
  additionalPotentials: string[]
  summary: EnhanceSummary
}

export interface EnhanceResponse {
  character: CharacterBrief & { imageUrl: string | null }
  items: EnhanceItem[]
  // 기록은 어제부터 거꾸로 모으므로 여기까지 모였다는 날짜
  syncedFrom: string | null
  syncing: boolean
}

// 한 장비의 스타포스 기록을 ★ 구간별(시도 전 ★ 기준)로 묶은 것
export interface StarforceStage {
  star: number
  attempts: number
  success: number
  fail: number
  destroy: number
  protect: number
  meso: number
}

// 하루 동안의 스타포스 기록. 시작 ★과 끝 ★은 그날 첫 시도 전과 마지막 시도 뒤
export interface StarforceDay {
  date: string
  attempts: number
  success: number
  destroy: number
  meso: number
  fromStar: number | null
  toStar: number | null
  events: EnhanceEvent[]
}

export interface StarforceDetail {
  stages: StarforceStage[]
  days: StarforceDay[]
  // 기록이 너무 많아 오래된 날을 잘랐으면 true
  truncated: boolean
}

// 등급이 한 번 오를 때까지 돌린 횟수. 기간 첫 기록부터 세므로 기간을 줄이면 첫 단계는 덜 셀 수 있다
export interface PotentialTier {
  from: string | null
  to: string
  tries: number
  at: string
}

export interface PotentialDay {
  date: string
  cubes: number
  resets: number
  meso: number
  // 이날 등급이 오른 횟수
  ups: number
  events: EnhanceEvent[]
}

export interface PotentialDetail {
  tiers: PotentialTier[]
  // 마지막으로 등급이 오른 뒤(없으면 기간 처음부터) 지금 등급에서 돌린 횟수와 시작 시각
  current: { grade: string | null, tries: number, since: string | null }
  days: PotentialDay[]
  truncated: boolean
}

// 공식 잠재 옵션 확률표. 줄(첫째·둘째·셋째)마다 옵션과 그 줄에서 뜰 확률(%)
export interface PotentialOption {
  text: string
  prob: number
}

export interface PotentialOptionTable {
  lines: PotentialOption[][]
}
