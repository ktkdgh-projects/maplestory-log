import type { DropSaleInput, MesoEntryInput } from '#shared/types'
import { DEFAULT_AUCTION_FEE, MVP_FEE } from '#shared/data/auction'
import { findMesoEntryType } from '#shared/data/mesoEntries'

// MVP 실버 이상이면 3%로 정해지고, 아니면 고른 값(PC방이면 3%)
export const hasMvpFee = (mvpDiscount: number | null | undefined) => (mvpDiscount ?? 0) >= MVP_FEE
export const effectiveFee = (fee: number | null | undefined, mvpDiscount: number | null | undefined) => (hasMvpFee(mvpDiscount) ? MVP_FEE : fee ?? DEFAULT_AUCTION_FEE)

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
