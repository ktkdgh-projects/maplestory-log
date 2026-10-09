import type { BossClear, BossLoot, DropSaleInput } from '#shared/types'

// 경매장 판매 수수료. 출처: 넥슨 공식 가이드 「메이플 옥션」, 나무위키 「메이플스토리/거래 시스템」 (2026-10-09 확인)
// 대금을 받을 때 MVP 실버 이상이거나 프리미엄 PC방이면 3%, 아니면 5%
export const AUCTION_FEES = [
  { rate: 0.05, label: '일반 5%' },
  { rate: 0.03, label: 'MVP 실버 이상 · PC방 3%' },
] as const
export const DEFAULT_AUCTION_FEE = 0.05

export function isAuctionFee(value: unknown): value is number {
  return AUCTION_FEES.some(f => f.rate === value)
}

// 금액 입력은 오타로 자릿수가 크게 들어가는 것만 막는다
export const MESO_MAX = 1e14

// 수수료를 떼고 실제로 손에 들어온 메소. 팔지 않은 템(price 없음)은 0
export function lootNet(loot: BossLoot): number {
  return loot.price ? afterFee(loot.price, loot.fee) : 0
}

// 경매장에 판 금액에서 수수료를 떼고 받은 메소
export function afterFee(price: number, fee: number): number {
  return Math.floor(price * (1 - fee))
}

export function dropSaleNet(sale: Pick<DropSaleInput, 'count' | 'unitPrice' | 'fee'>): number {
  return afterFee(sale.count * sale.unitPrice, sale.fee)
}

// 결정석 + 판 물욕템(수수료 뺀 금액)
export function clearMeso(clear: Pick<BossClear, 'meso' | 'loot'>): number {
  return clear.meso + clear.loot.reduce((sum, l) => sum + lootNet(l), 0)
}
