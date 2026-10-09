import { ObjectId } from 'mongodb'

// 연결한 캐릭터가 지금 낀 장비를 행으로 채운다. 이미 있는 장비 이름은 건너뛴다
export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const id = parseId(getRouterParam(event, 'id'))

  const { itemSheets, itemRows } = await useCollections()
  const sheet = await itemSheets.findOne({ _id: id, userId: user._id })
  if (!sheet) throw createError({ statusCode: 404, message: '시트를 찾을 수 없어요.' })
  if (!sheet.ocid) throw createError({ statusCode: 400, message: '캐릭터를 연결한 시트만 장비를 불러올 수 있어요.' })

  const equipment = await nexon.itemEquipment(await getUserApiKey(user._id), sheet.ocid).catch((error) => {
    throw toHttpError(error)
  })
  const existing = await itemRows.find({ userId: user._id, sheetId: id }, { projection: { name: 1, level: 1 } }).toArray()
  const have = new Set(existing.map(r => r.name))
  const fresh = equipment.item_equipment.filter(item => !have.has(item.item_name))
  if (fresh.length) {
    const { feeRate } = await loadLedgerSettings(user._id)
    await itemRows.insertMany(fresh.map((item, i) => ({
      _id: new ObjectId(),
      userId: user._id,
      sheetId: id,
      part: item.item_equipment_slot,
      name: item.item_name,
      icon: item.item_icon,
      buy: 0,
      sell: 0,
      sellFee: feeRate,
      memo: null,
      level: Number(item.item_base_option?.base_equipment_level) || null,
      order: existing.length + i,
    })))
  }
  // 이미 있던 장비도 착용 레벨이 비어 있으면 채운다 (스타포스 참고값 계산용)
  for (const item of equipment.item_equipment) {
    const level = Number(item.item_base_option?.base_equipment_level) || null
    const old = existing.find(r => r.name === item.item_name)
    if (level && old && !old.level) await itemRows.updateOne({ _id: old._id }, { $set: { level } })
  }
  return { added: fresh.length }
})
