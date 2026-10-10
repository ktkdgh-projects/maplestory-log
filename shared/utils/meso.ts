import type { BossClear, BossLoot, DropSaleInput, MesoEntryInput } from '#shared/types'
import { findMesoEntryType } from '#shared/data/mesoEntries'

// 경매장 판매 수수료. 출처: 넥슨 공식 가이드 「메이플 옥션」, 나무위키 「메이플스토리/거래 시스템」 (2026-10-09 확인)
// 대금을 받을 때 MVP 실버 이상이거나 프리미엄 PC방이면 3%, 아니면 5%
export const AUCTION_FEES = [
  { rate: 0.05, label: '일반 5%' },
  { rate: 0.03, label: 'MVP 실버 이상 · PC방 3%' },
] as const
export const DEFAULT_AUCTION_FEE = 0.05

// 내 정보의 MVP 등급이 실버 이상이면 수수료가 3%로 정해진다. 아니면 고른 값(PC방이면 3%)
export const MVP_FEE = 0.03
export const hasMvpFee = (mvpDiscount: number | null | undefined) => (mvpDiscount ?? 0) >= MVP_FEE
export const effectiveFee = (fee: number | null | undefined, mvpDiscount: number | null | undefined) => (hasMvpFee(mvpDiscount) ? MVP_FEE : fee ?? DEFAULT_AUCTION_FEE)

export function isAuctionFee(value: unknown): value is number {
  return AUCTION_FEES.some(f => f.rate === value)
}

// 금액 입력은 오타로 자릿수가 크게 들어가는 것만 막는다
export const MESO_MAX = 1e14
// 메소는 만 단위로 적는다. 화면 표기도 만 아래는 버린다
export const MESO_UNIT = 1e4
export const floorMeso = (value: number) => Math.floor(value / MESO_UNIT) * MESO_UNIT
// 입력칸 글자(만 단위, 쉼표 포함) ↔ 메소. 1을 치면 1만 메소
export const mesoToManText = (value: number | null) => (value === null ? '' : Math.floor(value / MESO_UNIT).toLocaleString('ko-KR'))
export function manTextToMeso(input: string): number | null {
  const digits = input.replace(/\D/g, '').slice(0, 12)
  return digits ? Number(digits) * MESO_UNIT : null
}

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

// 직접 등록 한 건이 보유 메소를 바꾸는 양. 나간 메소는 음수, 수수료가 붙는 종류(경매장 판매·메소 구매)는 수수료를 뗀 금액
export function mesoEntryDelta(entry: Pick<MesoEntryInput, 'type' | 'amount' | 'fee'>): number {
  const info = findMesoEntryType(entry.type)
  if (!info) return 0
  if (info.direction === 'out') return -entry.amount
  return info.fee ? afterFee(entry.amount, entry.fee ?? DEFAULT_AUCTION_FEE) : entry.amount
}

// 결정석 + 판 물욕템(수수료 뺀 금액)
export function clearMeso(clear: Pick<BossClear, 'meso' | 'loot'>): number {
  return clear.meso + clear.loot.reduce((sum, l) => sum + lootNet(l), 0)
}
