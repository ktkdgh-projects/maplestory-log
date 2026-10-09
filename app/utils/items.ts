import type { ItemRow } from '#shared/types'

export const itemSellNet = (row: ItemRow) => afterFee(row.sell, row.sellFee)

// 조각·심볼은 주기적으로 사서 구매 칸을 여러 건으로 적는다. 「마이스터 심볼」 같은 장비가 걸리지 않게 이름 전체가 맞아야 한다
const MULTI_PURCHASE_NAME = /^(솔 에르다 조각|(그랜드 )?(아케인|어센틱)?심볼)(\s*[x×]\s*\d+)?$/i
export const isMultiPurchase = (row: Pick<ItemRow, 'name'>) => MULTI_PURCHASE_NAME.test(row.name.trim())
export const rowInvest = (row: ItemRow) => row.buy + row.starforce + row.potential

// 아직 안 판 장비는 손익이 정해지지 않았으니 판매가를 적은 줄만 손익에 넣는다
export const itemProfit = (row: ItemRow): number | null => (row.sell ? itemSellNet(row) - rowInvest(row) : null)

export const profitTone = (profit: number | null) => (profit === null ? 'sub' : profit >= 0 ? 'gain' : 'loss')

export function itemTotals(rows: ItemRow[]) {
  let buy = 0
  let starforce = 0
  let potential = 0
  let sellGross = 0
  let sell = 0
  let net = 0
  let sold = 0
  for (const row of rows) {
    // 제외한 줄은 합계·손익 어디에도 넣지 않는다
    if (row.excluded) continue
    buy += row.buy
    starforce += row.starforce
    potential += row.potential
    sellGross += row.sell
    sell += itemSellNet(row)
    const profit = itemProfit(row)
    if (profit === null) continue
    net += profit
    sold++
  }
  return { buy, starforce, potential, sellGross, sell, invest: buy + starforce + potential, net, sold }
}
