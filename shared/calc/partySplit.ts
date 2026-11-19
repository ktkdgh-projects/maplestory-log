// 고를 수 있는 경매장 수수료: 기본 5%, MVP 3%, 직접 건네면 0%
export const PARTY_SPLIT_FEES = [0.05, 0.03, 0]

interface PartySplitInput {
  sale: number
  // 판매자가 경매장에 팔 때 떼이는 수수료
  saleFee: number
  // 소재·유행에 쓴 돈. 판 돈에서 먼저 빼서 낸 사람에게 돌려준다
  cost: number
  sellerId: string
  payerId: string
  // fee는 그 사람이 메소를 받을 때 떼이는 수수료(경매장이면 5·3%, 직접 받으면 0)
  members: { id: string, weight: number, fee: number }[]
}

interface PartySplitRow {
  id: string
  // 판매자가 이 사람 물건을 사 줄 가격. 판매자 본인은 0
  send: number
  // 수수료를 떼고 실제로 손에 들어오는 돈
  receive: number
  // 받는 돈에서 자기가 낸 비용을 뺀 몫
  own: number
}

// 판매 수수료·보낼 때 수수료·비용을 모두 똑같이 나눠서, 비용을 빼고 손에 남는 몫이 비율대로 같아지게 한다
export function partySplit(input: PartySplitInput): { net: number, rows: PartySplitRow[] } | null {
  const { sale, saleFee, cost, sellerId, payerId, members } = input
  const payer = members.find(m => m.id === payerId)
  if (!payer || !members.some(m => m.id === sellerId)) return null
  const net = Math.floor(sale * (1 - saleFee))
  // 받는 사람이 수수료를 떼이므로 그만큼 더 얹어 보내야 한다
  const gross = (fee: number) => 1 / (1 - fee)
  const costOut = payerId === sellerId ? cost : cost * gross(payer.fee)
  const denom = members.reduce((n, m) => n + m.weight * (m.id === sellerId ? 1 : gross(m.fee)), 0)
  const share = (net - costOut) / denom
  if (share <= 0) return null

  // 파티원 몫은 100 단위 아래를 버리고, 남는 끝자리는 판매자가 갖는다
  const rows = members.map((m): PartySplitRow => {
    if (m.id === sellerId) return { id: m.id, send: 0, receive: 0, own: 0 }
    const refund = m.id === payerId ? cost : 0
    const receive = Math.floor((m.weight * share + refund) / 100) * 100
    return { id: m.id, send: Math.ceil(receive / (1 - m.fee)), receive, own: receive - refund }
  })
  const seller = rows.find(r => r.id === sellerId)!
  seller.receive = net - rows.reduce((n, r) => n + r.send, 0)
  seller.own = seller.receive - (payerId === sellerId ? cost : 0)
  return { net, rows }
}
