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

export interface ItemFlow {
  date: string
  spent: number
  earned: number
}

export interface LedgerResponse {
  month: string
  hunts: HuntEntry[]
  clears: BossClear[]
  // 장비 결산에서 구매·강화 비용을 올리거나 판매가를 적은 날의 합계
  items: ItemFlow[]
}

export type ItemMoneyField = 'buy' | 'cost' | 'sell'

export interface ItemRow {
  id: string
  part: string
  name: string
  icon: string | null
  buy: number
  cost: number
  sell: number
  // 경매장 수수료율(5%·3%). 판매가에서 이만큼 떼고 손익·가계부에 잡는다
  sellFee: number
  memo: string | null
}

export interface ItemSheet {
  id: string
  title: string
  ocid: string | null
  characterName: string | null
  folded: boolean
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
  grade: string | null
  options: string[]
  addOptions: string[]
}

export interface EnhanceSummary {
  starforce: { attempts: number, success: number, destroy: number }
  cubes: number
  resets: number
  first: string | null
  last: string | null
}

export interface EnhanceItem {
  slot: string
  name: string
  icon: string
  starforce: number
  potentialGrade: string | null
  additionalGrade: string | null
  summary: EnhanceSummary
  events: EnhanceEvent[]
}

export interface EnhanceResponse {
  character: CharacterBrief & { imageUrl: string | null }
  items: EnhanceItem[]
  // 기록은 어제부터 거꾸로 모으므로 여기까지 모였다는 날짜
  syncedFrom: string | null
  syncing: boolean
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
