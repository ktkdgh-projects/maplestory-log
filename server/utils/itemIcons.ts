import type { ItemIcon } from '#shared/types'

const SEARCH_LIMIT = 12
// 넥슨 API가 아이콘을 주지 않거나 하나로 묶어 쓰는 아이템. 사용자 요청으로 넣은 그림(public/icons, maplestory.io KMS 389 아이콘)
// 심볼은 장비 결산에서 종류·지역을 나눌 필요가 없어 선택 심볼 교환권 그림 하나로 쓴다
const STATIC_ICONS: ItemIcon[] = [
  { name: '솔 에르다 조각', icon: '/icons/sol-erda-fragment.png', kind: 'etc', part: '기타' },
  { name: '심볼', icon: '/icons/symbol.png', kind: 'symbol', part: '기타' },
]

// 「블루밍 플로라 x3」처럼 개수를 붙여 적어도 같은 아이템으로 찾는다
export const iconKey = (name: string) => name.replace(/\s*[x×]\s*\d+\s*$/i, '').trim()
// 「반지1」「펜던트2」처럼 칸 번호가 붙은 장비 부위를 부위 이름만 남긴다
const partName = (slot: string | null | undefined) => (slot ?? '').replace(/\d+$/, '').trim()

type IconEntry = { name: string | null | undefined, icon: string | null | undefined, kind: ItemIcon['kind'], part: string }

async function rememberIcons(items: IconEntry[]) {
  const valid = items.filter((i): i is ItemIcon => !!i.name && !!i.icon)
  if (!valid.length) return
  const { itemIcons } = await useCollections()
  const now = new Date()
  await itemIcons.bulkWrite(valid.map(i => ({
    updateOne: { filter: { _id: i.name }, update: { $set: { icon: i.icon, kind: i.kind, part: i.part, updatedAt: now } }, upsert: true },
  })), { ordered: false })
}

// 장비 API에는 펫·캐시템이 없어서 따로 받아 사전에 넣는다
async function collectPetAndCashIcons(apiKey: string, ocid: string) {
  const [pets, cash] = await Promise.all([
    nexon.petEquipment(apiKey, ocid).catch(() => null),
    nexon.cashItemEquipment(apiKey, ocid).catch(() => null),
  ])
  const entries: IconEntry[] = []
  for (const prefix of ['pet_1', 'pet_2', 'pet_3', 'world_share_pet_1', 'world_share_pet_2', 'world_share_pet_3']) {
    entries.push({ name: pets?.[`${prefix}_name`] as string, icon: pets?.[`${prefix}_icon`] as string, kind: 'pet', part: '펫' })
    const equipment = pets?.[`${prefix}_equipment`] as { item_name?: string, item_icon?: string } | null | undefined
    entries.push({ name: equipment?.item_name, icon: equipment?.item_icon, kind: 'pet', part: '펫장비' })
  }
  for (const list of [cash?.cash_item_equipment_base, cash?.cash_item_equipment_preset_1, cash?.cash_item_equipment_preset_2, cash?.cash_item_equipment_preset_3, cash?.additional_cash_item_equipment_base]) {
    for (const item of list ?? []) entries.push({ name: item.cash_item_name, icon: item.cash_item_icon, kind: 'cash', part: partName(item.cash_item_equipment_part) })
  }
  await rememberIcons(entries)
}

// 캐릭터를 불러올 때 본 장비·펫·캐시템 아이콘을 사전에 모은다. 사전은 덤이라 실패해도 원래 작업은 그대로 간다
export async function collectCharacterIcons(apiKey: string, ocid: string, equipment: { name: string, icon: string, slot: string }[]) {
  await Promise.all([
    rememberIcons(equipment.map(i => ({ name: i.name, icon: i.icon, kind: 'equipment', part: partName(i.slot) }))),
    collectPetAndCashIcons(apiKey, ocid),
  ]).catch(() => {})
}

export async function lookupItems(names: string[]): Promise<Map<string, ItemIcon>> {
  const keys = [...new Set(names.map(iconKey))]
  if (!keys.length) return new Map()
  const { itemIcons } = await useCollections()
  const docs = await itemIcons.find({ _id: { $in: keys } }).toArray()
  return new Map([
    ...STATIC_ICONS.map(s => [s.name, s] as const),
    ...docs.map(d => [d._id, { name: d._id, icon: d.icon, kind: d.kind, part: d.part ?? '' }] as const),
  ])
}

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// 앞부분이 맞는 이름을 먼저, 그다음 중간에 들어간 이름
export async function searchIcons(query: string): Promise<ItemIcon[]> {
  const q = iconKey(query)
  if (!q) return []
  const { itemIcons } = await useCollections()
  const docs = await itemIcons.find({ _id: { $regex: escapeRegex(q) } }).limit(200).toArray()
  const found = [...STATIC_ICONS.filter(s => s.name.includes(q)), ...docs.map(d => ({ name: d._id, icon: d.icon, kind: d.kind, part: d.part ?? '' }))]
  return found
    .sort((a, b) => Number(!a.name.startsWith(q)) - Number(!b.name.startsWith(q)) || a.name.length - b.name.length)
    .slice(0, SEARCH_LIMIT)
}
