import type { BossDifficulty } from '#shared/data/bosses'
import { DIFFICULTY_LABELS, findBoss } from '#shared/data/bosses'

const CSV_TABLES = ['hunts', 'clears', 'items', 'enhance'] as const
type CsvTable = typeof CSV_TABLES[number]

function csvCell(value: unknown): string {
  const text = value == null ? '' : value instanceof Date ? value.toISOString() : String(value)
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function toCsv(header: string[], rows: unknown[][]): string {
  // 엑셀이 한글을 깨뜨리지 않게 BOM을 붙인다
  return `﻿${[header, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n')}\r\n`
}

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const body = await readBody<{ apiKey?: unknown, format?: unknown, table?: unknown }>(event)
  assertSameKey(user, body?.apiKey)
  const format = body?.format === 'csv' ? 'csv' : 'json'
  const table = CSV_TABLES.includes(body?.table as CsvTable) ? body!.table as CsvTable : null
  if (format === 'csv' && !table) throw createError({ statusCode: 400, message: '내보낼 표를 골라 주세요.' })

  const { hunts, bossRosters, bossClears, itemSheets, itemRows, ledgerSettings, enhanceEvents } = await useCollections()
  const userId = user._id
  const [huntDocs, roster, clearDocs, sheetDocs, rowDocs, settings, enhanceDocs] = await Promise.all([
    hunts.find({ userId }).sort({ date: 1, createdAt: 1 }).toArray(),
    bossRosters.findOne({ userId }),
    bossClears.find({ userId }).sort({ date: 1, createdAt: 1 }).toArray(),
    itemSheets.find({ userId }).sort({ order: 1 }).toArray(),
    itemRows.find({ userId }).sort({ order: 1 }).toArray(),
    ledgerSettings.findOne({ _id: userId }),
    enhanceEvents.find({ userId }).sort({ at: 1 }).toArray(),
  ])
  const sheetOf = new Map(sheetDocs.map(s => [s._id.toHexString(), s]))
  const date = kstToday()

  if (format === 'json') {
    setResponseHeaders(event, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="maplelog-${date}.json"`,
    })
    return {
      exportedAt: new Date().toISOString(),
      account: { createdAt: user.createdAt, consentAt: user.consentAt, mainOcid: user.mainOcid },
      ledger: {
        settings: settings ? { feeRate: settings.feeRate, balanceDate: settings.balanceDate, balance: settings.balance } : null,
        hunts: huntDocs.map(toHuntEntry),
        roster: roster?.characters ?? [],
        clears: clearDocs.map(toBossClear),
      },
      items: sheetDocs.map(s => toItemSheet(s, rowDocs.filter(r => r.sheetId.equals(s._id)))),
      enhance: enhanceDocs.map(({ userId: _u, _id, ...e }) => e),
    }
  }

  const csv = {
    hunts: () => toCsv(
      ['날짜', '메소', '사냥 시간(분)', '조각', '주흔', '메모'],
      huntDocs.map(h => [h.date, h.meso, h.minutes, h.fragments, h.traces, h.memo]),
    ),
    clears: () => toCsv(
      ['날짜', '주기', '캐릭터', '보스', '난이도', '파티', '결정석 메소', '물욕템(이름:판매가:수수료)'],
      clearDocs.map(c => [c.date, c.period, c.name, findBoss(c.bossId)?.name ?? c.bossId, DIFFICULTY_LABELS[c.difficulty as BossDifficulty] ?? c.difficulty, c.party, c.meso, (c.loot ?? []).map(l => `${l.item}:${l.price}:${l.fee}`).join(' / ')]),
    ),
    items: () => toCsv(
      ['시트', '부위', '장비', '구매', '큐브·스타포스', '판매', '수수료', '가계부 미반영', '메모'],
      rowDocs.map((r) => {
        const sheet = sheetOf.get(r.sheetId.toHexString())
        return [sheet?.title ?? '', r.part, r.name, r.buy, r.cost, r.sell, r.sellFee ?? '', sheet?.excluded ? 'Y' : '', r.memo]
      }),
    ),
    enhance: () => toCsv(
      ['시각', '종류', '캐릭터', '장비', '성공', '파괴', '이전 별', '이후 별', '도구', '등급', '잠재', '에디셔널'],
      enhanceDocs.map(e => [e.at, e.kind, e.character, e.item, e.success ? 'Y' : '', e.destroyed ? 'Y' : '', e.beforeStar, e.afterStar, e.tool, e.grade, e.options.join(' / '), e.addOptions.join(' / ')]),
    ),
  }[table!]()

  setResponseHeaders(event, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="maplelog-${table}-${date}.csv"`,
  })
  return csv
})
