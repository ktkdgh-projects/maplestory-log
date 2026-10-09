export type KeyStatus = 'valid' | 'invalid' | 'rate_limited' | 'deleted'

export interface CharacterBrief {
  ocid: string
  name: string
  world: string
  job: string
  level: number
}

export interface MeResponse {
  user: {
    keyLast4: string | null
    keyStatus: KeyStatus
    keyCheckedAt: string | null
    consentAt: string
    createdAt: string
    main: (CharacterBrief & { imageUrl: string | null }) | null
    isAdmin: boolean
  } | null
}

export interface AdminOverview {
  users: { total: number, active30d: number, byKeyStatus: Record<KeyStatus, number> }
  jobs: { pending: number, running: number, failed: number }
  today: { ok: number, empty: number, failed: number }
  // 수집 로그. 사용자는 id 끝 6자리로만 보여준다 (키는 처음부터 남기지 않는다)
  logs: { at: string, user: string, ocid: string, date: string, result: string, ms: number }[]
  paused: boolean
  pausedAt: string | null
}

export interface SessionInfo {
  id: string
  device: string
  remember: boolean
  createdAt: string
  lastUsedAt: string
  current: boolean
}

export interface ItemOption {
  label: string
  percent: boolean
  total: number
  base: number
  add: number
  etc: number
  starforce: number
  exceptional: number
}

export interface EquipmentItem {
  slot: string
  name: string
  icon: string
  requiredLevel: number
  starforce: number
  scrollUpgrade: number
  scrollUpgradeable: number
  goldenHammer: boolean
  options: ItemOption[]
  soul: string | null
  description: string | null
  potentialGrade: string | null
  potentials: string[]
  additionalGrade: string | null
  additionalPotentials: string[]
}

export interface SymbolInfo {
  name: string
  icon: string
  level: number
  growth: number
  requireGrowth: number
}

export interface HexaCore {
  name: string
  type: string
  level: number
}

export interface CharacterDetail {
  ocid: string
  name: string
  world: string
  job: string
  level: number
  exp: number
  expRate: number
  guild: string | null
  imageUrl: string
  combatPower: number | null
  unionLevel: number | null
  unionGrade: string | null
  dojangFloor: number | null
  stats: { name: string, value: string }[]
  presetNo: number
  presets: EquipmentItem[][]
  title: EquipmentItem | null
  android: EquipmentItem | null
  setEffects: { name: string, count: number, max: number, active: string[] }[]
  abilityPresetNo: number
  abilityPresets: { grade: string, value: string }[][]
  linkSkills: { name: string, icon: string, level: number, effect: string }[]
  symbols: SymbolInfo[]
  hexaCores: HexaCore[]
  fetchedAt: string
}

export interface UnionResponse {
  worlds: { name: string, count: number, active: boolean }[]
  world: string
  unionLevel: number | null
  unionGrade: string | null
  members: (CharacterBrief & { imageUrl: string | null })[]
  pending: number
}

export interface SnapshotPoint {
  date: string
  level: number
  exp: number
  expRate: number
  combatPower: number | null
}

export interface TrackedCharacter extends CharacterBrief {
  imageUrl: string | null
  isMain: boolean
}

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

export interface LedgerResponse {
  month: string
  hunts: HuntEntry[]
  clears: BossClear[]
  items: ItemFlow[]
  sales: DropSale[]
  // 지금까지 먹은 개수 - 판 개수 (전체 기간)
  stock: HuntDrops
}

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
  // 경매장 수수료율(5%·3%). 판매가에서 이만큼 떼고 손익·가계부에 잡는다
  sellFee: number
  memo: string | null
  // 예전에 산 장비처럼 들인 메소·손익·가계부에서 뺄 줄
  excluded: boolean
  // 착용 레벨. 현재 장비 불러오기로 채운다(스타포스 참고값 계산용)
  level: number | null
  // 구매일 이후 강화 기록으로 센 참고값. 잠재 메소 재설정은 공식 비용표, 스타포스는 위키 공식 추정(할인·복구 비용 빠짐)
  reference: { starforce: number, potential: number }
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

export type EnhanceKind = 'starforce' | 'cube' | 'potential'

export interface EnhanceEvent {
  kind: EnhanceKind
  at: string
  success: boolean
  destroyed: boolean
  beforeStar: number | null
  afterStar: number | null
  // 큐브 이름이나 '잠재능력 재설정' 같은 재설정 방식
  tool: string | null
  // 에디셔널(아랫잠)에 쓴 큐브·재설정이면 true
  additional: boolean
  grade: string | null
  options: string[]
  addOptions: string[]
  // 이 시도에 쓴 메소. 잠재 메소 재설정은 공식 비용표, 스타포스는 위키 비용 공식 추정. 큐브·주문서는 null
  meso: number | null
}

// 잠재(윗잠)와 에디셔널(아랫잠) 각각 큐브와 메소 재설정 횟수
export interface PotentialCounts {
  cubes: number
  resets: number
}

export interface EnhanceSummary {
  starforce: { attempts: number, success: number, destroy: number }
  potential: PotentialCounts
  additional: PotentialCounts
  meso: { starforce: number, potential: number, additional: number }
  first: string | null
  last: string | null
}

export interface EnhanceItem {
  slot: string
  name: string
  icon: string
  level: number | null
  starforce: number
  potentialGrade: string | null
  additionalGrade: string | null
  summary: EnhanceSummary
}

export interface EnhanceResponse {
  character: CharacterBrief & { imageUrl: string | null }
  items: EnhanceItem[]
  // 기록은 어제부터 거꾸로 모으므로 여기까지 모였다는 날짜
  syncedFrom: string | null
  syncing: boolean
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
}

export interface ItemsResponse {
  sheets: ItemSheet[]
}

export interface BossBoardResponse {
  week: string
  roster: BossRosterCharacter[]
  clears: BossClear[]
}

export interface SnapshotsResponse {
  character: (CharacterBrief & { imageUrl: string | null }) | null
  points: SnapshotPoint[]
  today: SnapshotPoint | null
  pending: number
}
