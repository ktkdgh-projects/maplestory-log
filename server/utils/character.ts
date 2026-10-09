import type { CharacterBrief, CharacterDetail, EquipmentItem, ItemOption } from '#shared/types'
import type { CharacterDoc } from './mongo'
import type { NexonItem, NexonItemOption } from './nexon'

const DETAIL_CACHE_MS = 60 * 60 * 1000
// 응답 모양을 바꾸면 올려서 예전 캐시를 안 쓰게 한다
const DETAIL_CACHE_VERSION = 15
const STAT_NAMES = ['전투력', '최소 스탯공격력', '최대 스탯공격력', '데미지', '보스 몬스터 데미지', '최종 데미지', '방어율 무시', '크리티컬 확률', '크리티컬 데미지', '공격력', '마력', '일반 몬스터 데미지', '속성 내성 무시', '상태이상 추가 데미지', 'STR', 'DEX', 'INT', 'LUK', 'HP', 'MP', '방어력', '상태이상 내성', '스탠스', '이동속도', '점프력', '공격 속도', '아이템 드롭률', '메소 획득량', '추가 경험치 획득', '버프 지속시간', '재사용 대기시간 감소 (초)', '재사용 대기시간 감소 (%)', '재사용 대기시간 미적용', '스타포스', '아케인포스', '어센틱포스']

export async function saveCharacter({ imageUrl, ...character }: Omit<CharacterDoc, 'updatedAt' | 'imageUrl'> & { imageUrl?: string }) {
  const { characters } = await useCollections()
  await characters.updateOne(
    { ocid: character.ocid },
    {
      $set: { ...character, ...(imageUrl && { imageUrl }), updatedAt: new Date() },
      ...(!imageUrl && { $setOnInsert: { imageUrl: null } }),
    },
    { upsert: true },
  )
}

export async function fetchAccountCharacters(apiKey: string): Promise<{ accountId: string | null, characters: CharacterBrief[] }> {
  const list = await nexon.characterList(apiKey).catch((error) => {
    throw toHttpError(error)
  })
  const characters = list.account_list
    .flatMap(account => account.character_list)
    .map(c => ({ ocid: c.ocid, name: c.character_name, world: c.world_name, job: c.character_class, level: c.character_level }))
    .sort((a, b) => b.level - a.level)
  return { accountId: list.account_list[0]?.account_id ?? null, characters }
}

export async function resolveOcid(apiKey: string, name: string): Promise<string> {
  const { characters } = await useCollections()
  const known = await characters.findOne({ name }, { projection: { ocid: 1 } })
  if (known) return known.ocid
  return (await nexon.ocid(apiKey, name)).ocid
}

// 게임 툴팁 순서. [넥슨 필드, 표시 이름, 퍼센트 여부]
const ITEM_OPTIONS: [string, string, boolean][] = [
  ['str', 'STR', false],
  ['dex', 'DEX', false],
  ['int', 'INT', false],
  ['luk', 'LUK', false],
  ['max_hp', '최대 HP', false],
  ['max_mp', '최대 MP', false],
  ['max_hp_rate', '최대 HP', true],
  ['max_mp_rate', '최대 MP', true],
  ['attack_power', '공격력', false],
  ['magic_power', '마력', false],
  ['armor', '방어력', false],
  ['speed', '이동속도', false],
  ['jump', '점프력', false],
  ['boss_damage', '보스 몬스터 데미지', true],
  ['ignore_monster_armor', '몬스터 방어율 무시', true],
  ['damage', '데미지', true],
  ['all_stat', '올스탯', true],
  ['equipment_level_decrease', '착용 레벨 감소', false],
]

const optionValue = (source: NexonItemOption | undefined, key: string) => Number(source?.[key] ?? 0) || 0

function toItemOptions(item: NexonItem): ItemOption[] {
  return ITEM_OPTIONS.flatMap(([key, label, percent]) => {
    const total = optionValue(item.item_total_option, key)
    if (!total) return []
    return [{
      label,
      percent,
      total,
      base: optionValue(item.item_base_option, key),
      add: optionValue(item.item_add_option, key),
      etc: optionValue(item.item_etc_option, key),
      starforce: optionValue(item.item_starforce_option, key),
      exceptional: optionValue(item.item_exceptional_option, key),
    }]
  })
}
function toEquipmentItem(item: NexonItem): EquipmentItem {
  return {
    slot: item.item_equipment_slot,
    name: item.item_name,
    icon: item.item_icon,
    requiredLevel: optionValue(item.item_base_option, 'base_equipment_level'),
    starforce: Number(item.starforce) || 0,
    scrollUpgrade: Number(item.scroll_upgrade) || 0,
    scrollUpgradeable: Number(item.scroll_upgradeable_count) || 0,
    goldenHammer: item.golden_hammer_flag === '적용',
    options: toItemOptions(item),
    soul: item.soul_name && item.soul_option ? `${item.soul_name} · ${item.soul_option}` : null,
    description: null,
    potentialGrade: item.potential_option_grade,
    potentials: [item.potential_option_1, item.potential_option_2, item.potential_option_3].filter((v): v is string => !!v),
    additionalGrade: item.additional_potential_option_grade,
    additionalPotentials: [item.additional_potential_option_1, item.additional_potential_option_2, item.additional_potential_option_3].filter((v): v is string => !!v),
  }
}

// 칭호·안드로이드처럼 이름·아이콘·설명만 있는 칸
function toSimpleItem(slot: string, name: string, icon: string, description: string | null): EquipmentItem {
  return {
    slot,
    name,
    icon,
    requiredLevel: 0,
    starforce: 0,
    scrollUpgrade: 0,
    scrollUpgradeable: 0,
    goldenHammer: false,
    options: [],
    soul: null,
    description,
    potentialGrade: null,
    potentials: [],
    additionalGrade: null,
    additionalPotentials: [],
  }
}

async function fetchDetail(apiKey: string, ocid: string): Promise<CharacterDetail> {
  // 호출량을 키마다 고르게 쓰도록 순차로 부른다
  const basic = await nexon.basic(apiKey, ocid)
  const stat = await nexon.stat(apiKey, ocid)
  const equipment = await nexon.itemEquipment(apiKey, ocid)
  const symbols = await nexon.symbolEquipment(apiKey, ocid)
  const hexa = await nexon.hexaMatrix(apiKey, ocid)
  const union = await nexon.union(apiKey, ocid)
  const dojang = await nexon.dojang(apiKey, ocid)
  const setEffect = await nexon.setEffect(apiKey, ocid)
  const ability = await nexon.ability(apiKey, ocid)
  const linkSkill = await nexon.linkSkill(apiKey, ocid)
  const android = await nexon.android(apiKey, ocid)

  const presets = [equipment.item_equipment_preset_1, equipment.item_equipment_preset_2, equipment.item_equipment_preset_3]
    .map(preset => (preset ?? []).map(toEquipmentItem))

  return {
    ocid,
    name: basic.character_name ?? '',
    world: basic.world_name,
    job: basic.character_class,
    level: basic.character_level,
    exp: basic.character_exp,
    expRate: Number(basic.character_exp_rate),
    guild: basic.character_guild_name,
    imageUrl: characterImageUrl(basic.character_image),
    combatPower: combatPowerOf(stat),
    unionLevel: union.union_level,
    unionGrade: union.union_grade,
    dojangFloor: dojang.dojang_best_floor,
    stats: STAT_NAMES.flatMap((name) => {
      const found = stat.final_stat.find(s => s.stat_name === name)
      return found ? [{ name, value: found.stat_value }] : []
    }),
    presetNo: equipment.preset_no ?? 1,
    presets: presets.some(p => p.length) ? presets : [equipment.item_equipment.map(toEquipmentItem), [], []],
    title: equipment.title && toSimpleItem('칭호', equipment.title.title_name, equipment.title.title_icon, equipment.title.title_description),
    android: android.android_name && android.android_icon ? toSimpleItem('안드로이드', android.android_name, android.android_icon, android.android_description) : null,
    setEffects: setEffect.set_effect
      .filter(s => s.total_set_count > 0)
      .map(s => ({
        name: s.set_name,
        count: s.total_set_count,
        max: Math.max(...s.set_option_full.map(o => o.set_count), s.total_set_count),
        active: s.set_effect_info.map(o => `${o.set_count}세트: ${o.set_option.replace(/\s+/g, ' ')}`),
      }))
      .sort((a, b) => b.count - a.count),
    abilityPresetNo: ability.preset_no ?? 1,
    abilityPresets: [ability.ability_preset_1, ability.ability_preset_2, ability.ability_preset_3]
      .map(preset => (preset?.ability_info ?? []).map(line => ({ grade: line.ability_grade, value: line.ability_value }))),
    linkSkills: (linkSkill.character_link_skill ?? []).map(s => ({ name: s.skill_name, icon: s.skill_icon, level: s.skill_level, effect: s.skill_effect })),
    symbols: symbols.symbol.map(s => ({
      name: s.symbol_name,
      icon: s.symbol_icon,
      level: s.symbol_level,
      growth: s.symbol_growth_count,
      requireGrowth: s.symbol_require_growth_count,
    })),
    hexaCores: (hexa.character_hexa_core_equipment ?? []).map(c => ({ name: c.hexa_core_name, type: c.hexa_core_type, level: c.hexa_core_level })),
    fetchedAt: new Date().toISOString(),
  }
}

export function getCharacterDetail(apiKey: string, ocid: string, fresh = false): Promise<CharacterDetail> {
  return withCache(`detail:${ocid}:v${DETAIL_CACHE_VERSION}`, DETAIL_CACHE_MS, async () => {
    const detail = await fetchDetail(apiKey, ocid)
    await saveCharacter({ ocid, name: detail.name, world: detail.world, job: detail.job, level: detail.level, imageUrl: detail.imageUrl })
    // 장비 결산에서 직접 적은 장비에도 아이콘을 붙이려고 본 아이템을 사전에 모은다
    await collectCharacterIcons(apiKey, ocid, detail.presets.flat())
    return detail
  }, fresh)
}
