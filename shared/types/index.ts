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
  } | null
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

export interface SnapshotsResponse {
  character: (CharacterBrief & { imageUrl: string | null }) | null
  points: SnapshotPoint[]
  pending: number
}
