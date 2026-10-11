import type { ItemRow } from '#shared/types'

// 조각·심볼은 주기적으로 사서 구매 칸을 여러 건으로 적는다. 「마이스터 심볼」 같은 장비가 걸리지 않게 이름 전체가 맞아야 한다
const MULTI_PURCHASE_NAME = /^(솔 에르다 조각|(그랜드 )?(아케인|어센틱)?심볼)(\s*[x×]\s*\d+)?$/i
export const isMultiPurchase = (row: Pick<ItemRow, 'name'>) => MULTI_PURCHASE_NAME.test(row.name.trim())

export const profitTone = (profit: number | null) => (profit === null ? 'sub' : profit >= 0 ? 'gain' : 'loss')
