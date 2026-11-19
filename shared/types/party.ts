export type PartyWeekStep = 'announce' | 'remindSubmit' | 'startVote' | 'askConfirm' | 'autoConfirm' | 'notice' | 'remindBoss'
// 시간 모으기 → 투표 → 투표 마감(파티장 확정 기다림) → 확정
export type PartyWeekPhase = 'collect' | 'vote' | 'decide' | 'confirmed'

// 파티장 화면에서 누르는 동작: 단계를 지금 돌리기, 보스 시간 확정, 이번 주만 다른 일정으로 다시 시작
export interface PartyLeadAction {
  action: 'run' | 'pick' | 'custom'
  step?: PartyWeekStep
  slot?: number
  // custom: 시간 적기 마감 시각(ISO)과 받을 첫 요일(목=0)
  deadline?: string
  fromDay?: number
}

export interface PartyLeadResponse {
  week: string
  partyName: string
  // 방금 한 동작의 결과
  note: string
  phase: PartyWeekPhase
  members: { character: string, submitted: boolean, voted: boolean }[]
  // 표가 많은 순서
  candidates: { slot: number, label: string, votes: number, missing: number, conflict: boolean }[]
  confirmed: { slot: number, label: string } | null
  steps: { key: PartyWeekStep, label: string, at: string | null, done: boolean }[]
  changeOpen: boolean
  // 이번 주만 다르게 잡은 일정이면 받는 첫 요일(목=0), 아니면 null
  customFromDay: number | null
}

export interface PartySplitInfo {
  partyName: string
  // 화면을 연 사람. 처음에는 이 사람이 판 것으로 둔다
  me: string
  members: { id: string, character: string }[]
}

export interface PartySplitRequest {
  sale: number
  cost: number
  feeRate: number
  sellerId: string
  payerId: string
  // 나누는 파티원
  memberIds: string[]
}

export interface PartyTimeResponse {
  week: string
  // 이 요일(목=0)부터만 적을 수 있다
  fromDay: number
  partyName: string
  slots: number[]
  saved: boolean
  lastWeekSlots: number[]
  // 투표가 시작돼서 더는 고칠 수 없다
  closed: boolean
  // 파티장이면 파티장 화면으로 가는 링크를 보여 준다
  leader: boolean
  members: { character: string, me: boolean, submitted: boolean }[]
}
