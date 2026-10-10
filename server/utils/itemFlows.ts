import type { ObjectId } from 'mongodb'
import type { ItemFlow, ItemPurchase } from '#shared/types'
import type { ItemRowDoc, ItemSheetDoc } from './mongo'

// shared: 같은 캐릭터에 같은 이름 장비가 여러 줄이라 기록을 어느 줄에 붙일지 몰라 비운 것. *Days: 날짜별 내역
export interface RowReference { starforce: number, potential: number, shared: boolean, starforceDays: ItemPurchase[], potentialDays: ItemPurchase[] }

// 강화 기록이 수백 건이라 비용 계산(eventMeso)에 쓰는 필드만 받는다
const REFERENCE_FIELDS = { _id: 0, kind: 1, character: 1, item: 1, at: 1, beforeStar: 1, beforeGrade: 1, itemLevel: 1, tool: 1, scroll: 1, superior: 1, protect: 1, eventDiscount: 1 }

// 캐릭터를 연결한 시트의 장비마다, 같은 캐릭터·같은 이름 장비의 강화 기록 중 구매일 이후 것으로 강화 비용 참고값을 센다.
// 강화 기록 페이지와 같은 계산(MVP 할인, 파괴 뒤 복구 메소 포함)이다
export async function rowReferences(userId: ObjectId, sheets: ItemSheetDoc[], rows: ItemRowDoc[], mvp: number): Promise<Map<string, RowReference>> {
  const characterOf = new Map(sheets.filter(s => s.characterName).map(s => [s._id.toHexString(), s.characterName!]))
  const linked = rows.filter(r => characterOf.has(r.sheetId.toHexString()))
  const result = new Map<string, RowReference>()
  if (!linked.length) return result

  const key = (character: string, item: string) => `${character}\n${item}`
  const rowKey = (row: ItemRowDoc) => key(characterOf.get(row.sheetId.toHexString())!, row.name)
  const rowsByKey = Map.groupBy(linked, rowKey)
  const levelOf = new Map(linked.map(r => [r.name, r.level ?? null]))
  const match = { character: { $in: [...new Set(characterOf.values())] }, item: { $in: [...new Set(linked.map(r => r.name))] } }

  const { enhanceEvents } = await useCollections()
  const [docs, restores] = await Promise.all([
    enhanceEvents.find({ userId, kind: { $in: ['starforce', 'potential'] }, ...match }, { projection: REFERENCE_FIELDS }).toArray(),
    restoresOf(userId, match, item => levelOf.get(item) ?? null),
  ])
  const byItem = Map.groupBy(docs, d => key(d.character, d.item))
  const restoresByItem = Map.groupBy(restores, r => key(r.character, r.item))

  for (const row of linked) {
    if (rowsByKey.get(rowKey(row))!.length > 1) {
      result.set(row._id.toHexString(), { starforce: 0, potential: 0, shared: true, starforceDays: [], potentialDays: [] })
      continue
    }
    const since = row.buyDate ? kstDayStart(row.buyDate) : null
    const starforceDays = new Map<string, number>()
    const potentialDays = new Map<string, number>()
    const add = (days: Map<string, number>, at: Date, meso: number) => {
      if (meso) days.set(kstDateOf(at), (days.get(kstDateOf(at)) ?? 0) + meso)
    }
    for (const doc of byItem.get(rowKey(row)) ?? []) {
      if (since && doc.at < since) continue
      add(doc.kind === 'starforce' ? starforceDays : potentialDays, doc.at, eventMeso(doc, row.level ?? null, mvp) ?? 0)
    }
    for (const r of restoresByItem.get(rowKey(row)) ?? []) {
      if (!since || r.at >= since) add(starforceDays, r.at, r.restore.fee)
    }
    const list = (days: Map<string, number>) => [...days].map(([date, amount]) => ({ date, amount })).sort((a, b) => a.date.localeCompare(b.date))
    const sum = (days: Map<string, number>) => [...days.values()].reduce((n, v) => n + v, 0)
    result.set(row._id.toHexString(), { starforce: sum(starforceDays), potential: sum(potentialDays), shared: false, starforceDays: list(starforceDays), potentialDays: list(potentialDays) })
  }
  return result
}

// 장비 결산에서 가계부로 넘어오는 날별 금액. 직접 적은 값만 쓰고, 가계부 미반영 시트와 제외한 줄은 뺀다
export async function itemFlows(userId: ObjectId, range: { from?: string, to?: string }): Promise<ItemFlow[]> {
  const { itemSheets, itemRows } = await useCollections()
  const [excludedSheets, allRows] = await Promise.all([
    itemSheets.find({ userId, excluded: true }, { projection: { _id: 1 } }).toArray(),
    itemRows.find({ userId, excluded: { $ne: true } }).toArray(),
  ])
  const skip = new Set(excludedSheets.map(s => s._id.toHexString()))
  const rows = allRows.filter(r => !skip.has(r.sheetId.toHexString()))

  const inRange = (date: string | null | undefined): date is string => !!date && (!range.from || date >= range.from) && (!range.to || date <= range.to)
  const days = new Map<string, ItemFlow>()
  const day = (date: string) => days.get(date) ?? days.set(date, { date, bought: 0, enhanced: 0, earned: 0 }).get(date)!
  for (const row of rows) {
    if (row.purchases?.length) {
      for (const p of row.purchases) if (inRange(p.date)) day(p.date).bought += p.amount
    }
    else if (row.buy && inRange(row.buyDate)) day(row.buyDate).bought += row.buy
    // 강화 비용도 날짜별 내역이 있으면 건마다 그 날짜로
    for (const [entries, total, date] of [[row.starforceEntries, row.starforce, row.starforceDate], [row.potentialEntries, row.potential, row.potentialDate]] as const) {
      if (entries?.length) {
        for (const e of entries) if (inRange(e.date)) day(e.date).enhanced += e.amount
      }
      else if (total && inRange(date)) day(date).enhanced += total
    }
    if (row.sell && inRange(row.sellDate)) day(row.sellDate).earned += afterFee(row.sell, row.sellFee ?? DEFAULT_AUCTION_FEE)
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date))
}
