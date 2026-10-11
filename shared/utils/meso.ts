import { AUCTION_FEES } from '#shared/data/auction'

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
