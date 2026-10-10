import type { BossDifficulty } from './bosses'

// 해방 계산기 데이터 (2026-10-10 확인). 보스 처치 재화는 입장 인원 수로 나눠 주고(소수점 버림), 남는 양은 다음 단계로 넘어간다
// 제네시스 해방(어둠의 흔적): 넥슨 공식 업데이트 1.2.398(2024-12-19, News/Update/762)
// 데스티니 초월(대적자의 결의): 1차는 공식 1.2.401(2025-03-20, News/Update/767), 2차·최대 누적·획득량 표는 공식 1.2.412(2026-02-12, News/Update/797)
// 벨로나는 공식 공지(1.2.418)에 결의 획득량이 없어 나무위키 「데스티니 무기」·메이플로드 계산기 값(두 곳 일치)을 쓴다

export type LiberationKind = 'genesis' | 'destiny'

export interface LiberationInfo {
  name: string
  currency: string
  steps: readonly { boss: string, need: number, tier?: string }[]
  cap: number
  // 보스(가계부 보스 id)·난이도별 획득량
  traces: Record<string, Partial<Record<BossDifficulty, number>>>
  // 넥슨 공식 해방 완료 단계(character/basic.liberation_quest_clear)가 이 값 이상이면 다 끝난 것
  doneAt: number
  // 공식 공지에 없어 위키 값을 쓰는 보스
  wikiBosses?: string[]
}

export const LIBERATIONS: Record<LiberationKind, LiberationInfo> = {
  genesis: {
    name: '제네시스 해방',
    currency: '어둠의 흔적',
    steps: [
      { boss: '반 레온', need: 500 },
      { boss: '아카이럼', need: 500 },
      { boss: '매그너스', need: 500 },
      { boss: '스우', need: 1000 },
      { boss: '데미안', need: 1000 },
      { boss: '윌', need: 1000 },
      { boss: '루시드', need: 1000 },
      { boss: '진 힐라', need: 1000 },
    ],
    cap: 1500,
    traces: {
      lotus: { normal: 10, hard: 50, extreme: 50 },
      damien: { normal: 10, hard: 50 },
      lucid: { easy: 15, normal: 20, hard: 65 },
      will: { easy: 15, normal: 25, hard: 75 },
      dusk: { normal: 20, chaos: 65 },
      dunkel: { normal: 25, hard: 75 },
      hilla: { normal: 45, hard: 90 },
      blackmage: { hard: 600, extreme: 600 },
    },
    doneAt: 1,
  },
  destiny: {
    name: '데스티니 초월',
    currency: '대적자의 결의',
    steps: [
      { boss: '세렌', need: 2000, tier: '1차' },
      { boss: '칼로스', need: 2500, tier: '1차' },
      { boss: '카링', need: 3000, tier: '1차' },
      { boss: '최초의 대적자', need: 10000, tier: '2차' },
      { boss: '림보', need: 12500, tier: '2차' },
      { boss: '발드릭스', need: 15000, tier: '2차' },
    ],
    cap: 15000,
    traces: {
      seren: { hard: 6, extreme: 80 },
      kalos: { normal: 10, chaos: 70, extreme: 400 },
      kaling: { normal: 20, hard: 160, extreme: 1200 },
      adversary: { normal: 15, hard: 120, extreme: 500 },
      star: { normal: 20, hard: 380 },
      limbo: { normal: 120, hard: 360 },
      baldrix: { normal: 150, hard: 450 },
      jupiter: { normal: 160, hard: 500 },
      bellona: { easy: 8, normal: 100, hard: 420 },
    },
    // 공식 문서엔 2(데스티니 1차)까지만 있어 2차 완료 값은 그보다 큰 값으로 본다
    doneAt: 3,
    wikiBosses: ['bellona'],
  },
}

// 데스티니 1차를 마친 캐릭터(완료 단계 2)는 2차 첫 단계부터 한다
export const DESTINY_SECOND_STEP = 3

// 제네시스 패스: 기간 한정 판매 상품. 흔적을 3배로 한 뒤 파티 인원으로 나누고 소수점은 버린다
// (공식 공지에서 배수를 찾지 못해 나무위키 「제네시스 무기」·devcomma 해방 계산기 기준, 두 곳 일치)
export const GENESIS_PASS_MULTIPLIER = 3

export function traceOf(kind: LiberationKind, bossId: string, difficulty: string, party: number, pass = false): number {
  const base = LIBERATIONS[kind].traces[bossId]?.[difficulty as BossDifficulty] ?? 0
  return Math.floor((base * (pass && kind === 'genesis' ? GENESIS_PASS_MULTIPLIER : 1)) / Math.max(1, party))
}

// 지금 낀 무기로 해방을 마쳤는지 본다
export const isGenesisWeapon = (name: string | undefined) => !!name?.includes('제네시스')
