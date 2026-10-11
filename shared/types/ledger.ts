import type { MesoEntryType } from '#shared/data/mesoEntries'
import type { CharacterBrief } from './character'

export interface HuntDrops {
  fragments: number
  traces: number
}

export interface HuntInput extends HuntDrops {
  date: string
  meso: number
  minutes: number | null
  memo: string | null
}

export interface HuntEntry extends HuntInput {
  id: string
}

export interface BossPick {
  bossId: string
  difficulty: string
  party: number
}

export interface BossRosterCharacter extends CharacterBrief {
  imageUrl: string | null
  bosses: BossPick[]
}

export interface BossLoot {
  item: string
  // 경매장에 판 금액(수수료 떼기 전). 아직 안 팔았거나 직접 쓰면 null
  price: number | null
  // 판 시점의 수수료율. 나중에 MVP 등급이 바뀌어도 그때 받은 돈이 그대로 남게 기록마다 둔다
  fee: number
}

export interface MesoBalance {
  // 실제 보유 메소를 맞춘 날과 금액
  checkedAt: string
  checked: number
  // 맞춘 날 이후 기록을 더하고 뺀 지금 보유 메소
  current: number
}

export interface LedgerSettings {
  feeRate: number
  balance: MesoBalance | null
}

export interface BossClear extends BossPick {
  id: string
  ocid: string
  name: string
  period: string
  date: string
  meso: number
  loot: BossLoot[]
}

// 장비 결산에서 그날 가계부로 넘어오는 금액. 구매는 구매일, 강화 비용은 적은 날, 판매는 판매일
export interface ItemFlow {
  date: string
  bought: number
  enhanced: number
  earned: number
}

// 사냥에서 먹은 재료를 경매장에 판 기록. 개당 가격 × 개수에서 수수료를 떼고 수입으로 잡는다
export interface DropSaleInput {
  date: string
  item: keyof HuntDrops
  count: number
  unitPrice: number
  fee: number
}

export interface DropSale extends DropSaleInput {
  id: string
}

// 가계부에 직접 등록한 지출·수입(메소 판매, 경매장 구매 등)
export interface MesoEntryInput {
  date: string
  type: MesoEntryType
  // 메소. 수수료가 붙는 종류(경매장 판매·메소 구매)는 수수료를 떼기 전 금액
  amount: number
  // 메소 판매·구매 때 받은·낸 현금(원)
  cash: number | null
  // 경매장에서 산·판 물건 이름과, 검색해서 골랐으면 그 아이콘
  item: string | null
  icon: string | null
  // 수수료가 붙는 종류의 경매장 수수료율
  fee: number | null
  memo: string | null
}

export interface MesoEntry extends MesoEntryInput {
  id: string
}

// 메소 내역: 메소가 움직인 기록을 날짜·종류별 한 줄로
export type MesoHistoryKind = 'hunt' | 'boss' | 'sale' | 'item' | 'entry' | 'base'

// 메소 내역에서 바로 지울 수 있는 기록. 장비는 장비 결산 시트 값이라 여기서 지우지 않는다
export interface MesoHistoryRef {
  kind: 'hunt' | 'sale' | 'clear' | 'entry'
  id: string
}

export interface MesoHistoryRow {
  key: string
  kind: MesoHistoryKind
  title: string
  detail: string
  // 들어온 메소는 양수, 나간 메소는 음수. 맞추기 줄은 0
  amount: number
  // 이 줄까지 반영한 보유 메소. 맞춘 날보다 앞이면 null
  balance: number | null
  // 장비 한 건이면 그 아이템 아이콘
  icon: string | null
  // 여러 건을 한 줄로 묶었으면 건별 내역
  children: { label: string, amount: number, icon?: string | null, ref?: MesoHistoryRef | null }[]
  // 한 건짜리 줄을 지울 때 쓰는 값
  ref: MesoHistoryRef | null
  // 직접 등록한 건이면 고치기·지우기에 쓴다
  entry: MesoEntry | null
}

export interface MesoHistoryDay {
  date: string
  net: number
  rows: MesoHistoryRow[]
}

export interface MesoHistoryResponse {
  from: string
  to: string
  balance: MesoBalance | null
  totals: { income: number, spent: number, byKind: Partial<Record<MesoHistoryKind, { income: number, spent: number }>> }
  // 최신 날이 먼저, 날 안에서는 나중 기록이 먼저
  days: MesoHistoryDay[]
  // 날마다 그날 끝 보유 메소(맞춘 날부터)
  series: { date: string, balance: number }[]
}

export interface LedgerResponse {
  month: string
  hunts: HuntEntry[]
  clears: BossClear[]
  items: ItemFlow[]
  sales: DropSale[]
  entries: MesoEntry[]
  // 지금까지 먹은 개수 - 판 개수 (전체 기간)
  stock: HuntDrops
}

export interface BossBoardResponse {
  week: string
  roster: BossRosterCharacter[]
  clears: BossClear[]
}
