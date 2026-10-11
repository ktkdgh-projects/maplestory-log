// cash: 받은·낸 현금(원)도 적는다, item: 산·판 물건 이름을 적는다, fee: 경매장으로 받아 수수료를 뗀다(메소 구매도 받는 쪽이 낸다)
export const MESO_ENTRY_TYPES = [
  { key: 'meso-sell', label: '메소 판매', direction: 'out', cash: true, item: false, fee: false },
  { key: 'auction-buy', label: '경매장 구매', direction: 'out', cash: false, item: true, fee: false },
  { key: 'etc-out', label: '기타 지출', direction: 'out', cash: false, item: false, fee: false },
  { key: 'meso-buy', label: '메소 구매', direction: 'in', cash: true, item: false, fee: true },
  { key: 'auction-sell', label: '경매장 판매', direction: 'in', cash: false, item: true, fee: true },
  { key: 'etc-in', label: '기타 수입', direction: 'in', cash: false, item: false, fee: false },
] as const

export type MesoEntryType = typeof MESO_ENTRY_TYPES[number]['key']
export type MesoEntryInfo = typeof MESO_ENTRY_TYPES[number]

export const findMesoEntryType = (key: string): MesoEntryInfo | undefined => MESO_ENTRY_TYPES.find(t => t.key === key)
