export interface ItemRow {
  id: string
  part: string
  name: string
  icon: string | null
  buy: number
  buyDate: string | null
  // 조각·심볼처럼 여러 번 나눠 사는 줄의 구매 내역. buy는 그 합계, buyDate는 가장 이른 날
  purchases: ItemPurchase[]
  // 직접 적은 강화 비용과 적은 날. 가계부에는 이 값만 넘어간다
  starforce: number
  starforceDate: string | null
  potential: number
  potentialDate: string | null
  sell: number
  sellDate: string | null
  // 경매장 수수료율(5%·3%). 판매가에서 이만큼 떼고 손익·가계부에 잡는다. 내 정보 MVP가 실버 이상이면 3%로 맞춰 내려준다
  sellFee: number
  memo: string | null
  // 예전에 산 장비처럼 들인 메소·손익·가계부에서 뺄 줄
  excluded: boolean
  // 착용 레벨. 현재 장비 불러오기로 채운다(스타포스 참고값 계산용)
  level: number | null
  // 강화 비용을 날짜별로 나눈 내역. 가계부에는 건마다 그 날짜로 들어간다
  starforceEntries: ItemPurchase[]
  potentialEntries: ItemPurchase[]
  // 구매일 이후 강화 기록으로 센 참고값(MVP 할인·복구 메소 포함)과 날짜별 내역. 같은 이름 장비가 여러 줄이면 나눌 수 없어 shared로 비운다
  reference: { starforce: number, potential: number, shared: boolean, starforceDays: ItemPurchase[], potentialDays: ItemPurchase[] }
}

export interface ItemSheet {
  id: string
  title: string
  ocid: string | null
  characterName: string | null
  // 가계부에 넣지 않는 시트(예전에 산 장비 정리용). 장비 결산 손익에는 그대로 들어간다
  excluded: boolean
  rows: ItemRow[]
}

export interface ItemPurchase {
  date: string
  amount: number
}

export interface ItemIcon {
  name: string
  icon: string
  kind: 'equipment' | 'pet' | 'cash' | 'symbol' | 'etc'
  // 장비 결산 부위 칸에 들어갈 이름 (반지, 펫, 기타 …)
  part: string
  // 장비 착용 레벨(장비만, 본 적 있을 때)
  level?: number
}

export interface ItemsResponse {
  sheets: ItemSheet[]
}
