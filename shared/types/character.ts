export interface CharacterBrief {
  ocid: string
  name: string
  world: string
  job: string
  level: number
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
  // 해방 완료 단계 (넥슨 공식): 0 미완료, 1 제네시스 해방, 2 데스티니 1차 해방
  liberation: number
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
  // 성장 기록에 남은 최근 날짜별 실제 전투력(최신순). 추산을 실제 값으로 맞춰 보는 데 쓴다
  recentPowers?: { date: string, value: number }[]
}

export interface UnionResponse {
  // account: 내 계정 캐릭터 목록(이미지 포함) · raider: 남의 캐릭터라 공격대에 배치된 직업·레벨만
  mode: 'account' | 'raider'
  worlds: { name: string, count: number, active: boolean }[]
  world: string
  unionLevel: number | null
  unionGrade: string | null
  members: (CharacterBrief & { imageUrl: string | null })[]
  raiders: { job: string, level: number, type: string }[]
  pending: number
}
