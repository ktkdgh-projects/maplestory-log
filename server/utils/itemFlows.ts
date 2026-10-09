import type { ObjectId } from 'mongodb'
import type { ItemFlow } from '#shared/types'
import type { ItemRowDoc, ItemSheetDoc } from './mongo'

export interface RowReference { starforce: number, potential: number }

// 캐릭터를 연결한 시트의 장비마다, 같은 캐릭터·같은 이름 장비의 강화 기록 중 구매일 이후 것으로 강화 비용 참고값을 센다
export async function rowReferences(userId: ObjectId, sheets: ItemSheetDoc[], rows: ItemRowDoc[]): Promise<Map<string, RowReference>> {
  const characterOf = new Map(sheets.filter(s => s.characterName).map(s => [s._id.toHexString(), s.characterName!]))
  const linked = rows.filter(r => characterOf.has(r.sheetId.toHexString()))
  const result = new Map<string, RowReference>()
  if (!linked.length) return result

  const { enhanceEvents } = await useCollections()
  const docs = await enhanceEvents.find({
    userId,
    kind: { $in: ['starforce', 'potential'] },
    character: { $in: [...new Set(characterOf.values())] },
    item: { $in: [...new Set(linked.map(r => r.name))] },
  }).toArray()

  for (const row of linked) {
    const character = characterOf.get(row.sheetId.toHexString())
    const since = row.buyDate ? kstDayStart(row.buyDate) : null
    const sum: RowReference = { starforce: 0, potential: 0 }
    for (const doc of docs) {
      if (doc.character !== character || doc.item !== row.name || (since && doc.at < since)) continue
      const meso = eventMeso(doc, row.level ?? null) ?? 0
      if (doc.kind === 'starforce') sum.starforce += meso
      else sum.potential += meso
    }
    result.set(row._id.toHexString(), sum)
  }
  return result
}

// 장비 결산에서 가계부로 넘어오는 날별 금액. 직접 적은 값만 쓰고, 가계부 미반영 시트는 뺀다
export async function itemFlows(userId: ObjectId, range: { from?: string, to?: string }): Promise<ItemFlow[]> {
  const { itemSheets, itemRows } = await useCollections()
  const sheets = await itemSheets.find({ userId, excluded: { $ne: true } }, { projection: { _id: 1 } }).toArray()
  if (!sheets.length) return []
  const rows = await itemRows.find({ userId, sheetId: { $in: sheets.map(s => s._id) } }).toArray()

  const inRange = (date: string | null | undefined): date is string => !!date && (!range.from || date >= range.from) && (!range.to || date <= range.to)
  const days = new Map<string, ItemFlow>()
  const day = (date: string) => days.get(date) ?? days.set(date, { date, bought: 0, enhanced: 0, earned: 0 }).get(date)!
  for (const row of rows) {
    if (row.buy && inRange(row.buyDate)) day(row.buyDate).bought += row.buy
    if (row.starforce && inRange(row.starforceDate)) day(row.starforceDate).enhanced += row.starforce
    if (row.potential && inRange(row.potentialDate)) day(row.potentialDate).enhanced += row.potential
    if (row.sell && inRange(row.sellDate)) day(row.sellDate).earned += afterFee(row.sell, row.sellFee ?? DEFAULT_AUCTION_FEE)
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date))
}
