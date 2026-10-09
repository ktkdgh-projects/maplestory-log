const BASE_URL = 'https://open.api.nexon.com/maplestory/v1'
const RETRY_DELAYS_MS = [500, 1000, 2000]

// 오픈 API 공개일. 이보다 이른 날짜는 조회하지 않는다
export const NEXON_DATA_START_DATE = '2023-12-21'

export const NEXON_ERROR = {
  INTERNAL: 'OPENAPI00001',
  FORBIDDEN: 'OPENAPI00002',
  INVALID_ID: 'OPENAPI00003',
  INVALID_PARAMETER: 'OPENAPI00004',
  INVALID_KEY: 'OPENAPI00005',
  INVALID_PATH: 'OPENAPI00006',
  RATE_LIMITED: 'OPENAPI00007',
  DATA_PREPARING: 'OPENAPI00009',
  GAME_MAINTENANCE: 'OPENAPI00010',
  API_MAINTENANCE: 'OPENAPI00011',
} as const

export class NexonError extends Error {
  constructor(public code: string, public status: number, message: string) {
    super(message)
  }

  get isKeyProblem() {
    return this.code === NEXON_ERROR.INVALID_KEY || this.code === NEXON_ERROR.FORBIDDEN
  }

  get isMaintenance() {
    return this.code === NEXON_ERROR.GAME_MAINTENANCE || this.code === NEXON_ERROR.API_MAINTENANCE
  }
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function nexonGet<T>(path: string, apiKey: string, query: Record<string, string | number | undefined> = {}): Promise<T> {
  const url = new URL(BASE_URL + path)
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) url.searchParams.set(key, String(value))
  }

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { 'x-nxopen-api-key': apiKey } })
    if (res.ok) return await res.json() as T

    const body = await res.json().catch(() => null) as { error?: { name?: string, message?: string } } | null
    const error = new NexonError(body?.error?.name ?? `HTTP_${res.status}`, res.status, body?.error?.message ?? res.statusText)

    if (error.code === NEXON_ERROR.RATE_LIMITED && attempt < RETRY_DELAYS_MS.length) {
      await sleep(RETRY_DELAYS_MS[attempt]!)
      continue
    }
    throw error
  }
}

interface NexonCharacterList {
  account_list: {
    account_id: string
    character_list: {
      ocid: string
      character_name: string
      world_name: string
      character_class: string
      character_level: number
    }[]
  }[]
}

interface NexonBasic {
  date: string | null
  character_name: string | null
  world_name: string
  character_class: string
  character_level: number
  character_exp: number
  character_exp_rate: string
  character_guild_name: string | null
  character_image: string
}

interface NexonStat {
  final_stat: { stat_name: string, stat_value: string }[]
}

export type NexonItemOption = Record<string, string | number | undefined>

export interface NexonItem {
  item_equipment_slot: string
  item_name: string
  item_icon: string
  item_total_option: NexonItemOption
  item_base_option: NexonItemOption
  item_add_option: NexonItemOption
  item_etc_option: NexonItemOption
  item_starforce_option: NexonItemOption
  item_exceptional_option: NexonItemOption
  starforce: string
  scroll_upgrade: string
  scroll_upgradeable_count: string
  golden_hammer_flag: string
  soul_name: string | null
  soul_option: string | null
  potential_option_grade: string | null
  potential_option_1: string | null
  potential_option_2: string | null
  potential_option_3: string | null
  additional_potential_option_grade: string | null
  additional_potential_option_1: string | null
  additional_potential_option_2: string | null
  additional_potential_option_3: string | null
}

interface NexonItemEquipment {
  preset_no: number | null
  item_equipment: NexonItem[]
  item_equipment_preset_1: NexonItem[] | null
  item_equipment_preset_2: NexonItem[] | null
  item_equipment_preset_3: NexonItem[] | null
  title: { title_name: string, title_icon: string, title_description: string | null } | null
}

interface NexonSymbolEquipment {
  symbol: {
    symbol_name: string
    symbol_icon: string
    symbol_level: number
    symbol_growth_count: number
    symbol_require_growth_count: number
  }[]
}

interface NexonHexaMatrix {
  character_hexa_core_equipment: {
    hexa_core_name: string
    hexa_core_level: number
    hexa_core_type: string
  }[] | null
}

interface NexonSetEffect {
  set_effect: {
    set_name: string
    total_set_count: number
    set_effect_info: { set_count: number, set_option: string }[]
    set_option_full: { set_count: number, set_option: string }[]
  }[]
}

type NexonAbilityPreset = { ability_info: { ability_grade: string, ability_value: string }[] } | null

interface NexonAbility {
  preset_no: number | null
  ability_info: { ability_grade: string, ability_value: string }[] | null
  ability_preset_1: NexonAbilityPreset
  ability_preset_2: NexonAbilityPreset
  ability_preset_3: NexonAbilityPreset
}

interface NexonLinkSkill {
  character_link_skill: { skill_name: string, skill_icon: string, skill_level: number, skill_effect: string }[] | null
}

interface NexonAndroid {
  android_name: string | null
  android_icon: string | null
  android_description: string | null
}

export interface NexonUnion {
  union_level: number | null
  union_grade: string | null
}

interface NexonDojang {
  dojang_best_floor: number | null
}

interface NexonOptionLine {
  value: string
  grade: string
}

export interface NexonHistoryEvent {
  id: string
  character_name: string
  target_item: string
  date_create: string
  item_upgrade_result?: string
  before_starforce_count?: number
  after_starforce_count?: number
  cube_type?: string
  potential_type?: string
  potential_option_grade?: string
  after_potential_option?: NexonOptionLine[]
  after_additional_potential_option?: NexonOptionLine[]
}

type NexonHistoryPage<K extends string> = { count: number, next_cursor: string | null } & Record<K, NexonHistoryEvent[]>

const HISTORY_PAGE_SIZE = 1000

// 하루치 기록이 한 쪽(1000건)을 넘으면 next_cursor로 이어 받는다
async function historyOfDay<K extends string>(path: string, listKey: K, apiKey: string, date: string): Promise<NexonHistoryEvent[]> {
  const events: NexonHistoryEvent[] = []
  let page = await nexonGet<NexonHistoryPage<K>>(path, apiKey, { count: HISTORY_PAGE_SIZE, date })
  events.push(...(page[listKey] ?? []))
  while (page.next_cursor) {
    page = await nexonGet<NexonHistoryPage<K>>(path, apiKey, { count: HISTORY_PAGE_SIZE, cursor: page.next_cursor })
    events.push(...(page[listKey] ?? []))
  }
  return events
}

// 스타포스·큐브·잠재능력 재설정(메소) 기록. 계정 단위라 캐릭터 이름이 기록마다 들어 있다
export const nexonHistory = {
  starforce: (apiKey: string, date: string) => historyOfDay('/history/starforce', 'starforce_history', apiKey, date),
  cube: (apiKey: string, date: string) => historyOfDay('/history/cube', 'cube_history', apiKey, date),
  potential: (apiKey: string, date: string) => historyOfDay('/history/potential', 'potential_history', apiKey, date),
}

export const nexon = {
  characterList: (apiKey: string) => nexonGet<NexonCharacterList>('/character/list', apiKey),
  ocid: (apiKey: string, name: string) => nexonGet<{ ocid: string }>('/id', apiKey, { character_name: name }),
  basic: (apiKey: string, ocid: string, date?: string) => nexonGet<NexonBasic>('/character/basic', apiKey, { ocid, date }),
  stat: (apiKey: string, ocid: string, date?: string) => nexonGet<NexonStat>('/character/stat', apiKey, { ocid, date }),
  itemEquipment: (apiKey: string, ocid: string) => nexonGet<NexonItemEquipment>('/character/item-equipment', apiKey, { ocid }),
  symbolEquipment: (apiKey: string, ocid: string) => nexonGet<NexonSymbolEquipment>('/character/symbol-equipment', apiKey, { ocid }),
  hexaMatrix: (apiKey: string, ocid: string) => nexonGet<NexonHexaMatrix>('/character/hexamatrix', apiKey, { ocid }),
  android: (apiKey: string, ocid: string) => nexonGet<NexonAndroid>('/character/android-equipment', apiKey, { ocid }),
  linkSkill: (apiKey: string, ocid: string) => nexonGet<NexonLinkSkill>('/character/link-skill', apiKey, { ocid }),
  ability: (apiKey: string, ocid: string) => nexonGet<NexonAbility>('/character/ability', apiKey, { ocid }),
  setEffect: (apiKey: string, ocid: string) => nexonGet<NexonSetEffect>('/character/set-effect', apiKey, { ocid }),
  union: (apiKey: string, ocid: string) => nexonGet<NexonUnion>('/user/union', apiKey, { ocid }),
  dojang: (apiKey: string, ocid: string) => nexonGet<NexonDojang>('/character/dojang', apiKey, { ocid }),
}

// 넥슨이 붙여 주는 모션 옵션(예: wmotion=W02) 중에는 그림을 못 만들어 빈 대체 이미지가 오는 경우가 있어 기본 모션으로 쓴다
export function characterImageUrl(url: string): string {
  return url.split('?')[0]!
}

export function combatPowerOf(stat: NexonStat): number | null {
  const value = stat.final_stat.find(s => s.stat_name === '전투력')?.stat_value
  return value ? Number(value) : null
}

export function toHttpError(error: unknown) {
  if (!(error instanceof NexonError)) return error
  if (error.isKeyProblem) return createError({ statusCode: 400, message: '키가 올바르지 않거나 더 이상 작동하지 않아요. 키를 확인해 주세요.' })
  if (error.code === NEXON_ERROR.RATE_LIMITED) return createError({ statusCode: 429, message: '넥슨 API 호출 한도를 넘었어요. 잠시 후 다시 시도해 주세요.' })
  if (error.isMaintenance) return createError({ statusCode: 503, message: '넥슨 점검 중이에요. 점검이 끝난 뒤 다시 시도해 주세요.' })
  if (error.code === NEXON_ERROR.DATA_PREPARING) return createError({ statusCode: 503, message: '넥슨에서 데이터를 준비 중이에요. 잠시 후 다시 시도해 주세요.' })
  if (error.code === NEXON_ERROR.INVALID_ID || error.code === NEXON_ERROR.INVALID_PARAMETER) return createError({ statusCode: 404, message: '캐릭터를 찾을 수 없어요.' })
  return createError({ statusCode: 502, message: '넥슨 API 응답에 문제가 있어요. 잠시 후 다시 시도해 주세요.' })
}
