// 출처: 넥슨 공식 가이드 「메이플 옥션」, 나무위키 「메이플스토리/거래 시스템」 (2026-10-09 확인)
export const AUCTION_FEES = [
  { rate: 0.05, label: '일반 5%' },
  { rate: 0.03, label: 'MVP 실버 이상 · PC방 3%' },
] as const
export const DEFAULT_AUCTION_FEE = 0.05

// 내 정보의 MVP 등급이 실버 이상이면 수수료가 3%로 정해진다
export const MVP_FEE = 0.03
