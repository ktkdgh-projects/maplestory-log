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

  // 닉네임을 바꿨으면 예전 이름으로 남은 기록도 지금 시트 이름으로 묶는다
  const { enhanceEvents, characters } = await useCollections()
  const currentOf = new Map<string, string>()
  const renamed = await characters.find({ ocid: { $in: sheets.flatMap(s => (s.ocid ? [s.ocid] : [])) }, pastNames: { $exists: true } }, { projection: { ocid: 1, pastNames: 1 } }).toArray()
  for (const doc of renamed) {
    const name = sheets.find(s => s.ocid === doc.ocid)?.characterName
    if (name) for (const past of doc.pastNames ?? []) currentOf.set(past, name)
  }
  const key = (character: string, item: string) => `${currentOf.get(character) ?? character}\n${item}`
  const rowKey = (row: ItemRowDoc) => key(characterOf.get(row.sheetId.toHexString())!, row.name)
  const rowsByKey = Map.groupBy(linked, rowKey)
  const levelOf = new Map(linked.map(r => [r.name, r.level ?? null]))
  const match = { character: { $in: [...new Set([...characterOf.values(), ...currentOf.keys()])] }, item: { $in: [...new Set(linked.map(r => r.name))] } }

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

export interface ItemFlowEvent {
  date: string
  kind: 'buy' | 'starforce' | 'potential' | 'sell'
  name: string
  icon: string | null
  // 들어온 메소는 양수, 나간 메소는 음수
  amount: number
}

// 장비 결산에서 가계부로 넘어오는 금액을 장비·날짜별 한 건씩. 직접 적은 값만 쓰고, 가계부 미반영 시트와 제외한 줄은 뺀다
export async function itemFlowEvents(userId: ObjectId, range: { from?: string, to?: string }): Promise<ItemFlowEvent[]> {
  const { itemSheets, itemRows, users } = await useCollections()
  const [excludedSheets, allRows, user] = await Promise.all([
    itemSheets.find({ userId, excluded: true }, { projection: { _id: 1 } }).toArray(),
    itemRows.find({ userId, excluded: { $ne: true } }).toArray(),
    users.findOne({ _id: userId }, { projection: { mvpDiscount: 1 } }),
  ])
  const skip = new Set(excludedSheets.map(s => s._id.toHexString()))
  const rows = allRows.filter(r => !skip.has(r.sheetId.toHexString()))

  const inRange = (date: string | null | undefined): date is string => !!date && (!range.from || date >= range.from) && (!range.to || date <= range.to)
  const events: ItemFlowEvent[] = []
  const push = (date: string, kind: ItemFlowEvent['kind'], row: ItemRowDoc, amount: number) => {
    if (amount) events.push({ date, kind, name: row.name, icon: row.icon ?? null, amount })
  }
  for (const row of rows) {
    if (row.purchases?.length) {
      for (const p of row.purchases) if (inRange(p.date)) push(p.date, 'buy', row, -p.amount)
    }
    else if (row.buy && inRange(row.buyDate)) push(row.buyDate, 'buy', row, -row.buy)
    // 강화 비용도 날짜별 내역이 있으면 건마다 그 날짜로
    for (const [kind, entries, total, date] of [['starforce', row.starforceEntries, row.starforce, row.starforceDate], ['potential', row.potentialEntries, row.potential, row.potentialDate]] as const) {
      if (entries?.length) {
        for (const e of entries) if (inRange(e.date)) push(e.date, kind, row, -e.amount)
      }
      else if (total && inRange(date)) push(date, kind, row, -total)
    }
    if (row.sell && inRange(row.sellDate)) push(row.sellDate, 'sell', row, afterFee(row.sell, effectiveFee(row.sellFee, user?.mvpDiscount)))
  }
  return events.sort((a, b) => a.date.localeCompare(b.date))
}

// 장비 결산에서 가계부로 넘어오는 날별 금액
export async function itemFlows(userId: ObjectId, range: { from?: string, to?: string }): Promise<ItemFlow[]> {
  const days = new Map<string, ItemFlow>()
  for (const e of await itemFlowEvents(userId, range)) {
    const day = days.get(e.date) ?? days.set(e.date, { date: e.date, bought: 0, enhanced: 0, earned: 0 }).get(e.date)!
    if (e.kind === 'buy') day.bought -= e.amount
    else if (e.kind === 'sell') day.earned += e.amount
    else day.enhanced -= e.amount
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date))
}
