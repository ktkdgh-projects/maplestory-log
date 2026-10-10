import type { ObjectId } from 'mongodb'
import type { ItemIcon, ItemPurchase, ItemRow, ItemSheet } from '#shared/types'
import type { RowReference } from './itemFlows'
import type { ItemRowDoc, ItemSheetDoc } from './mongo'

const TEXT_MAX = 40
const MAX_ORDER_IDS = 100

const fail = (message: string) => createError({ statusCode: 400, message })

export function parseMeso(value: unknown, label: string): number {
  if (value === null || value === undefined || value === '') return 0
  const n = Number(value)
  if (!Number.isSafeInteger(n) || n < 0 || n > MESO_MAX) throw fail(`${label}을(를) 0 이상의 숫자로 적어 주세요.`)
  return n
}

const MAX_PURCHASES = 200

export function parsePurchases(value: unknown): ItemPurchase[] {
  if (!Array.isArray(value) || value.length > MAX_PURCHASES) throw fail(`구매 내역은 ${MAX_PURCHASES}건까지 적을 수 있어요.`)
  return (value as Record<string, unknown>[])
    .map(p => ({ date: parseDate(p?.date), amount: parseMeso(p?.amount, '금액') }))
    .filter(p => p.amount > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
}

export function parseText(value: unknown, label: string, required = true): string {
  const text = typeof value === 'string' ? value.trim().slice(0, TEXT_MAX) : ''
  if (required && !text) throw fail(`${label}을(를) 적어 주세요.`)
  return text
}

export function parseIdList(value: unknown): ObjectId[] {
  if (!Array.isArray(value) || !value.length || value.length > MAX_ORDER_IDS) throw fail('순서 정보가 올바르지 않아요.')
  return value.map(v => parseId(typeof v === 'string' ? v : undefined))
}

function toItemRow(doc: ItemRowDoc, reference: RowReference | undefined, known: Map<string, ItemIcon>, mvp: number): ItemRow {
  return {
    id: doc._id.toHexString(),
    part: doc.part,
    name: doc.name,
    // 직접 적은 장비는 아이콘이 없어서 사전에서 같은 이름을 찾아 붙인다
    icon: doc.icon ?? known.get(iconKey(doc.name))?.icon ?? null,
    buy: doc.buy,
    buyDate: doc.buyDate ?? null,
    // 내역 없이 한 번에 적은 금액은 그 날짜의 한 건으로 본다
    purchases: doc.purchases ?? (doc.buy && doc.buyDate ? [{ date: doc.buyDate, amount: doc.buy }] : []),
    starforce: doc.starforce ?? 0,
    starforceDate: doc.starforceDate ?? null,
    potential: doc.potential ?? 0,
    potentialDate: doc.potentialDate ?? null,
    starforceEntries: doc.starforceEntries ?? (doc.starforce && doc.starforceDate ? [{ date: doc.starforceDate, amount: doc.starforce }] : []),
    potentialEntries: doc.potentialEntries ?? (doc.potential && doc.potentialDate ? [{ date: doc.potentialDate, amount: doc.potential }] : []),
    sell: doc.sell,
    sellDate: doc.sellDate ?? null,
    sellFee: effectiveFee(doc.sellFee, mvp),
    memo: doc.memo,
    excluded: doc.excluded ?? false,
    level: doc.level ?? null,
    reference: reference ?? { starforce: 0, potential: 0, shared: false, starforceDays: [], potentialDays: [] },
  }
}

export function toItemSheet(doc: ItemSheetDoc, rows: ItemRowDoc[], references: Map<string, RowReference>, known: Map<string, ItemIcon>, mvp = 0): ItemSheet {
  return {
    id: doc._id.toHexString(),
    title: doc.title,
    ocid: doc.ocid,
    characterName: doc.characterName,
    excluded: doc.excluded ?? false,
    rows: rows.filter(r => r.sheetId.equals(doc._id)).map(r => toItemRow(r, references.get(r._id.toHexString()), known, mvp)),
  }
}
