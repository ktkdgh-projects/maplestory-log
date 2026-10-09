import type { ItemRow } from '#shared/types'

export const itemSellNet = (row: ItemRow) => afterFee(row.sell, row.sellFee)
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
