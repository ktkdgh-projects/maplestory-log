import { ObjectId, type Collection, type Filter } from 'mongodb'
import type { BossClear, BossLoot, BossPick, BossRosterCharacter, DropSale, DropSaleInput, HuntEntry, HuntInput, MesoEntry, MesoEntryInput } from '#shared/types'
import { findMesoEntryType } from '#shared/data/mesoEntries'
import { MAX_BOSS_CHARACTERS, MAX_PARTY, WEEKLY_BOSS_LIMIT, bossOrder, findBoss } from '#shared/data/bosses'
import { dropSaleNet, effectiveFee, mesoEntryDelta } from '#shared/calc/meso'
import { clearMeso } from '#shared/calc/boss'
import { DEFAULT_AUCTION_FEE } from '#shared/data/auction'
import type { BossClearDoc, DropSaleDoc, HuntDoc, MesoEntryDoc } from './mongo'

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const COUNT_MAX = 1e6
const MEMO_MAX = 200
// 사냥·판매·직접 등록은 하루 몇 줄이라 몇 년을 적어도 넘지 않는다. 마구 쌓아 DB를 채우는 것만 막는다
const MAX_LEDGER_RECORDS = 5000

const fail = (message: string) => createError({ statusCode: 400, message })

// 형식만 맞는 2026-13-01 같은 날짜는 Date로 바꿨다 되돌리면 달라진다
const realDate = (value: string) => {
  const ms = Date.parse(`${value}T00:00:00Z`)
  return !Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 10) === value
}

export async function assertLedgerRoom<T extends { userId: ObjectId }>(collection: Collection<T>, userId: ObjectId) {
  const used = await collection.countDocuments({ userId } as Filter<T>, { limit: MAX_LEDGER_RECORDS })
  if (used >= MAX_LEDGER_RECORDS) throw createError({ statusCode: 409, message: `가계부 기록은 종류마다 ${MAX_LEDGER_RECORDS.toLocaleString()}개까지 남길 수 있어요. 오래된 기록을 지우고 다시 적어 주세요.` })
}

export function parseDate(value: unknown): string {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value) || !realDate(value) || value > kstToday()) throw fail('날짜를 오늘이나 그 전으로 골라 주세요.')
  return value
}

function count(value: unknown, label: string, max = COUNT_MAX): number {
  if (value === null || value === undefined || value === '') return 0
  const n = Number(value)
  if (!Number.isSafeInteger(n) || n < 0 || n > max) throw fail(`${label}을(를) 0 이상의 숫자로 적어 주세요.`)
  return n
}

export function parseHuntInput(body: Record<string, unknown> | null | undefined): HuntInput {
  const input = {
    date: parseDate(body?.date),
    meso: count(body?.meso, '메소', MESO_MAX),
    fragments: count(body?.fragments, '조각'),
    traces: count(body?.traces, '주문의 흔적'),
    minutes: count(body?.minutes, '사냥 시간', 24 * 60) || null,
    memo: typeof body?.memo === 'string' && body.memo.trim() ? body.memo.trim().slice(0, MEMO_MAX) : null,
  }
  if (!input.meso && !input.fragments && !input.traces) throw fail('메소나 조각·주흔 중 하나는 적어 주세요.')
  return input
}

export function toHuntEntry(doc: HuntDoc): HuntEntry {
  const { _id, userId: _userId, createdAt: _createdAt, ...input } = doc
  return { id: _id.toHexString(), ...input }
}

// 주문의 흔적은 거래가 안 돼서 조각만 팔 수 있다
const SELLABLE_DROPS = ['fragments'] as const

export function parseDropSale(body: Record<string, unknown> | null | undefined, defaultFee: number): DropSaleInput {
  if (!SELLABLE_DROPS.includes(body?.item as typeof SELLABLE_DROPS[number])) throw fail('팔 수 있는 재료가 아니에요.')
  const input = {
    date: parseDate(body?.date),
    item: body!.item as DropSaleInput['item'],
    count: count(body?.count, '판 개수'),
    unitPrice: count(body?.unitPrice, '개당 가격', MESO_MAX),
    fee: isAuctionFee(body?.fee) ? body.fee : defaultFee,
  }
  if (!input.count || !input.unitPrice) throw fail('판 개수와 개당 가격을 적어 주세요.')
  if (input.count * input.unitPrice > MESO_MAX) throw fail('판매 금액이 너무 커요.')
  return input
}

const CASH_MAX = 1e10
const ENTRY_ITEM_MAX = 40
// 아이콘은 넥슨 아이콘이나 사이트에 둔 그림만 받는다. 끝까지 맞춰 봐서 ..이나 다른 경로가 끼어들 수 없게 한다
const ICON_PATTERN = /^(?:https:\/\/open\.api\.nexon\.com\/static\/maplestory\/[\w/-]{1,200}|\/icons\/[\w-]{1,60}\.(?:png|svg|webp))$/

export function parseMesoEntry(body: Record<string, unknown> | null | undefined, defaultFee: number): MesoEntryInput {
  const info = findMesoEntryType(String(body?.type))
  if (!info) throw fail('지출·수입 종류를 골라 주세요.')
  const amount = floorMeso(count(body?.amount, '메소', MESO_MAX))
  if (amount < MESO_UNIT) throw fail('메소를 1만 이상 적어 주세요.')
  const text = (value: unknown, max: number) => (typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null)
  return {
    date: parseDate(body?.date),
    type: info.key,
    amount,
    cash: info.cash ? count(body?.cash, '현금', CASH_MAX) || null : null,
    item: info.item ? text(body?.item, ENTRY_ITEM_MAX) : null,
    icon: info.item && typeof body?.icon === 'string' && ICON_PATTERN.test(body.icon) ? body.icon : null,
    fee: info.fee ? (isAuctionFee(body?.fee) ? body.fee : defaultFee) : null,
    memo: text(body?.memo, MEMO_MAX),
  }
}

export function toMesoEntry(doc: MesoEntryDoc): MesoEntry {
  const { _id, userId: _userId, createdAt: _createdAt, ...input } = doc
  return { id: _id.toHexString(), ...input, icon: input.icon ?? null }
}

// 이름만 치고 목록에서 고르지 않은 물건은 아이콘 사전에서 같은 이름을 찾아 붙인다
export async function toMesoEntries(docs: MesoEntryDoc[]): Promise<MesoEntry[]> {
  const entries = docs.map(toMesoEntry)
  const known = await lookupItems(entries.flatMap(e => (e.item && !e.icon ? [e.item] : [])))
  return entries.map(e => (e.item && !e.icon ? { ...e, icon: known.get(iconKey(e.item))?.icon ?? null } : e))
}

export function toDropSale(doc: DropSaleDoc): DropSale {
  const { _id, userId: _userId, createdAt: _createdAt, ...input } = doc
  return { id: _id.toHexString(), ...input }
}

// 수수료를 고르기 전에 저장된 물욕템은 기본 수수료로 본다
export const bossLootOf = (doc: Pick<BossClearDoc, 'loot'>): BossLoot[] => (doc.loot ?? []).map(l => ({ ...l, fee: l.fee ?? DEFAULT_AUCTION_FEE }))

export function toBossClear(doc: BossClearDoc): BossClear {
  return {
    id: doc._id.toHexString(),
    ocid: doc.ocid,
    name: doc.name,
    period: doc.period,
    bossId: doc.bossId,
    difficulty: doc.difficulty,
    party: doc.party,
    date: doc.date,
    meso: doc.meso,
    loot: bossLootOf(doc),
  }
}

const MAX_LOOT = 10

// 드롭표에 없는 템도 직접 적을 수 있어 이름은 길이만 제한한다. 수수료를 안 골랐으면 기본값을 쓴다
export function parseLoot(value: unknown, defaultFee: number): BossLoot[] {
  if (!Array.isArray(value) || value.length > MAX_LOOT) throw fail(`물욕템은 ${MAX_LOOT}개까지 적을 수 있어요.`)
  return (value as Record<string, unknown>[]).map((raw) => {
    const item = typeof raw?.item === 'string' ? raw.item.trim().slice(0, 40) : ''
    if (!item) throw fail('아이템 이름을 적어 주세요.')
    const price = raw?.price === null || raw?.price === undefined || raw?.price === '' ? null : count(raw.price, '판매가', MESO_MAX)
    const fee = isAuctionFee(raw?.fee) ? raw.fee : defaultFee
    return { item, price, fee }
  })
}

// 경매장 수수료 기본값: 내 정보의 MVP 등급이 실버 이상이면 3%, 아니면 마지막으로 고른 값
export async function loadLedgerSettings(userId: ObjectId) {
  const { ledgerSettings, users } = await useCollections()
  const [doc, user] = await Promise.all([
    ledgerSettings.findOne({ _id: userId }),
    users.findOne({ _id: userId }, { projection: { mvpDiscount: 1 } }),
  ])
  return { feeRate: effectiveFee(doc?.feeRate, user?.mvpDiscount), balanceDate: doc?.balanceDate ?? null, balance: doc?.balance ?? null }
}

// 마지막으로 고른 수수료를 다음 판매의 기본값으로 기억한다
export async function rememberFeeRate(userId: ObjectId, feeRate: number) {
  const { ledgerSettings } = await useCollections()
  await ledgerSettings.updateOne({ _id: userId }, { $set: { feeRate, updatedAt: new Date() }, $setOnInsert: { balanceDate: null, balance: null } }, { upsert: true })
}

// 맞춘 금액은 그날 기록을 반영하기 전 보유 메소라서, 맞춘 날 기록부터 더하고 뺀다
export async function currentBalance(userId: ObjectId, balanceDate: string, balance: number): Promise<number> {
  const { hunts, bossClears, dropSales, mesoEntries } = await useCollections()
  const after = { $gte: balanceDate }
  const [huntDocs, clearDocs, flows, saleDocs, entryDocs] = await Promise.all([
    hunts.find({ userId, date: after }, { projection: { meso: 1 } }).toArray(),
    bossClears.find({ userId, date: after }, { projection: { meso: 1, loot: 1 } }).toArray(),
    itemFlows(userId, { from: balanceDate }),
    dropSales.find({ userId, date: after }, { projection: { count: 1, unitPrice: 1, fee: 1 } }).toArray(),
    mesoEntries.find({ userId, date: after }, { projection: { type: 1, amount: 1, fee: 1 } }).toArray(),
  ])
  let total = balance
  for (const h of huntDocs) total += h.meso
  for (const c of clearDocs) total += clearMeso({ meso: c.meso, loot: bossLootOf(c) })
  for (const f of flows) total += f.earned - f.bought - f.enhanced
  for (const s of saleDocs) total += dropSaleNet(s)
  for (const e of entryDocs) total += mesoEntryDelta(e)
  return total
}

// 남의 기록 id든 형식이 틀린 id든 똑같이 404로 돌려 있는지조차 알 수 없게 한다
export function parseId(value: string | undefined): ObjectId {
  if (!value || !ObjectId.isValid(value)) throw createError({ statusCode: 404, message: '기록을 찾을 수 없어요.' })
  return new ObjectId(value)
}

function parsePicks(value: unknown): BossPick[] {
  if (!Array.isArray(value)) throw fail('보스 목록이 올바르지 않아요.')
  const picks: BossPick[] = []
  for (const raw of value as Record<string, unknown>[]) {
    const boss = findBoss(String(raw?.bossId))
    if (!boss || !Object.hasOwn(boss.prices, String(raw?.difficulty))) throw fail('없는 보스나 난이도가 있어요.')
    if (picks.some(p => p.bossId === boss.id)) throw fail(`${boss.name}은(는) 한 난이도만 고를 수 있어요.`)
    const party = Number(raw?.party)
    if (!Number.isInteger(party) || party < 1 || party > MAX_PARTY) throw fail(`파티 인원은 1~${MAX_PARTY}명이에요.`)
    picks.push({ bossId: boss.id, difficulty: String(raw.difficulty), party })
  }
  const weekly = picks.filter(p => findBoss(p.bossId)!.cycle === 'weekly').length
  if (weekly > WEEKLY_BOSS_LIMIT) throw fail(`주간 보스는 캐릭터당 ${WEEKLY_BOSS_LIMIT}개까지 잡을 수 있어요.`)
  // 게임 순서대로 저장해 두면 화면마다 다시 정렬할 필요가 없다
  return picks.sort((a, b) => bossOrder(a.bossId) - bossOrder(b.bossId))
}

// 캐릭터는 내 계정 목록에 있는 것만 받는다. 이름·레벨은 넥슨 목록 값으로 덮어써서 조작된 값이 남지 않게 한다
export async function parseRoster(userId: ObjectId, value: unknown): Promise<BossRosterCharacter[]> {
  if (!Array.isArray(value) || value.length > MAX_BOSS_CHARACTERS) throw fail(`주간 보스 캐릭터는 ${MAX_BOSS_CHARACTERS}명까지예요.`)
  const apiKey = await getUserApiKey(userId)
  const { characters: account } = await fetchAccountCharacters(apiKey)
  const { characters: saved } = await useCollections()
  const roster: BossRosterCharacter[] = []
  for (const raw of value as Record<string, unknown>[]) {
    const character = account.find(c => c.ocid === raw?.ocid)
    if (!character) throw fail('내 계정의 캐릭터만 고를 수 있어요.')
    if (roster.some(r => r.ocid === character.ocid)) continue
    let imageUrl = (await saved.findOne({ ocid: character.ocid }, { projection: { imageUrl: 1 } }))?.imageUrl ?? null
    // 처음 고른 부캐는 이미지가 없어서 한 번만 받아 둔다
    if (!imageUrl) {
      imageUrl = await nexon.basic(apiKey, character.ocid).then(b => characterImageUrl(b.character_image)).catch(() => null)
      await saveCharacter({ ...character, ...(imageUrl && { imageUrl }) })
    }
    roster.push({ ...character, imageUrl, bosses: parsePicks(raw?.bosses) })
  }
  return roster
}
