import type { ObjectId } from 'mongodb'
import type { ItemRow, ItemSheet } from '#shared/types'
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

export function parseText(value: unknown, label: string, required = true): string {
  const text = typeof value === 'string' ? value.trim().slice(0, TEXT_MAX) : ''
  if (required && !text) throw fail(`${label}을(를) 적어 주세요.`)
  return text
}

export function parseIdList(value: unknown): ObjectId[] {
  if (!Array.isArray(value) || !value.length || value.length > MAX_ORDER_IDS) throw fail('순서 정보가 올바르지 않아요.')
  return value.map(v => parseId(typeof v === 'string' ? v : undefined))
}

function toItemRow(doc: ItemRowDoc): ItemRow {
  return {
    id: doc._id.toHexString(),
    part: doc.part,
    name: doc.name,
    icon: doc.icon,
    buy: doc.buy,
    cost: doc.cost,
    sell: doc.sell,
    sellFee: doc.sellFee ?? DEFAULT_AUCTION_FEE,
    memo: doc.memo,
  }
}

export function toItemSheet(doc: ItemSheetDoc, rows: ItemRowDoc[]): ItemSheet {
  return {
    id: doc._id.toHexString(),
    title: doc.title,
    ocid: doc.ocid,
    characterName: doc.characterName,
    folded: doc.folded,
    excluded: doc.excluded ?? false,
    rows: rows.filter(r => r.sheetId.equals(doc._id)).map(toItemRow),
  }
}
