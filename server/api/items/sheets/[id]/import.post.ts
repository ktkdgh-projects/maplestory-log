import { ObjectId } from 'mongodb'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const id = parseId(getRouterParam(event, 'id'))

  const { itemSheets, itemRows } = await useCollections()
  const sheet = await itemSheets.findOne({ _id: id, userId: user._id })
  if (!sheet) throw createError({ statusCode: 404, message: '시트를 찾을 수 없어요.' })
  if (!sheet.ocid) throw createError({ statusCode: 400, message: '캐릭터를 연결한 시트만 장비를 불러올 수 있어요.' })

  const apiKey = await getUserApiKey(user._id)
  const equipment = await nexon.itemEquipment(apiKey, sheet.ocid).catch((error) => {
    throw toHttpError(error)
  })
  await collectCharacterIcons(apiKey, sheet.ocid, equipment.item_equipment.map(i => ({ name: i.item_name, icon: i.item_icon, slot: i.item_equipment_slot, level: Number(i.item_base_option?.base_equipment_level) || undefined })))
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
  // 착용 레벨은 스타포스 참고값 계산에 쓰여 이미 있던 줄도 비어 있으면 채운다
  const levelFills = equipment.item_equipment.flatMap((item) => {
    const level = Number(item.item_base_option?.base_equipment_level) || null
    const old = existing.find(r => r.name === item.item_name)
    return level && old && !old.level ? [{ updateOne: { filter: { _id: old._id, userId: user._id }, update: { $set: { level } } } }] : []
  })
  if (levelFills.length) await itemRows.bulkWrite(levelFills, { ordered: false })
  return { added: fresh.length }
})
