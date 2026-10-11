import type { ObjectId } from 'mongodb'
import type { MesoHistoryDay, MesoHistoryKind, MesoHistoryResponse, MesoHistoryRow } from '#shared/types'
import { DIFFICULTY_LABELS, findBoss, type BossDifficulty } from '#shared/data/bosses'
import { findMesoEntryType } from '#shared/data/mesoEntries'
import { dropSaleNet, mesoEntryDelta } from '#shared/calc/meso'
import { clearMeso } from '#shared/calc/boss'

// 같은 날 안에서 잔액을 쌓는 순서. 화면엔 거꾸로(나중 것이 위) 보여 준다
const KIND_ORDER: MesoHistoryKind[] = ['hunt', 'sale', 'boss', 'item', 'entry']
const FRAGMENT_ICON = '/icons/sol-erda-fragment.png'
const ITEM_KIND_LABELS = { buy: '구매', starforce: '스타포스', potential: '잠재', sell: '판매' } as const

const bossName = (bossId: string, difficulty: string) => `${DIFFICULTY_LABELS[difficulty as BossDifficulty] ?? ''} ${findBoss(bossId)?.name ?? bossId}`.trim()
const sum = (list: { amount: number }[]) => list.reduce((n, c) => n + c.amount, 0)

// 여러 건이면 묶은 한 줄 + 건별 내역, 한 건이면 그 건 그대로
function grouped(key: string, kind: MesoHistoryKind, children: MesoHistoryRow['children'], title: (n: number) => string, detail: string): MesoHistoryRow {
  const one = children.length === 1
  return { key, kind, title: one ? children[0]!.label : title(children.length), detail, amount: sum(children), balance: null, icon: one ? children[0]!.icon ?? null : null, children: one ? [] : children, ref: one ? children[0]!.ref ?? null : null, entry: null }
}

export async function mesoHistory(userId: ObjectId, from: string, to: string): Promise<MesoHistoryResponse> {
  const { balanceDate, balance } = await loadLedgerSettings(userId)
  // 잔액은 맞춘 날부터 쌓아야 하므로, 고른 기간보다 맞춘 날이 앞이면 거기서부터 받는다
  const start = balanceDate && balanceDate < from ? balanceDate : from
  const range = { $gte: start, $lte: to }
  const { hunts, bossClears, dropSales, mesoEntries } = await useCollections()
  const [huntDocs, clearDocs, saleDocs, entryDocs, itemEvents] = await Promise.all([
    hunts.find({ userId, date: range }).sort({ createdAt: 1 }).toArray(),
    bossClears.find({ userId, date: range }).sort({ createdAt: 1 }).toArray(),
    dropSales.find({ userId, date: range }).sort({ createdAt: 1 }).toArray(),
    mesoEntries.find({ userId, date: range }).sort({ createdAt: 1 }).toArray(),
    itemFlowEvents(userId, { from: start, to }),
  ])

  const byDate = new Map<string, MesoHistoryRow[]>()
  const add = (date: string, row: MesoHistoryRow) => (byDate.get(date) ?? byDate.set(date, []).get(date)!).push(row)

  for (const [date, list] of Map.groupBy(huntDocs, h => h.date)) {
    const minutes = list.reduce((n, h) => n + (h.minutes ?? 0), 0)
    const fragments = list.reduce((n, h) => n + h.fragments, 0)
    const detail = [minutes ? formatHuntTime(minutes) : '', fragments ? `조각 ${fragments.toLocaleString('ko-KR')}개` : ''].filter(Boolean).join(' · ')
    add(date, grouped(`hunt:${date}`, 'hunt', list.map(h => ({ label: h.memo ? `사냥 · ${h.memo}` : `사냥${h.minutes ? ` ${formatHuntTime(h.minutes)}` : ''}`, amount: h.meso, ref: { kind: 'hunt' as const, id: h._id.toHexString() } })), n => `사냥 ${n}번`, detail))
  }
  for (const [date, list] of Map.groupBy(saleDocs, s => s.date)) {
    const count = list.reduce((n, s) => n + s.count, 0)
    const gross = list.reduce((n, s) => n + s.count * s.unitPrice, 0)
    const detail = `개당 ${formatKoreanNumber(Math.round(gross / count))}${list.length > 1 ? '(평균)' : ''}`
    const row = grouped(`sale:${date}`, 'sale', list.map(s => ({ label: `조각 ${s.count.toLocaleString('ko-KR')}개 × ${formatKoreanNumber(s.unitPrice)}`, amount: dropSaleNet(s), icon: FRAGMENT_ICON, ref: { kind: 'sale' as const, id: s._id.toHexString() } })), () => `조각 ${count.toLocaleString('ko-KR')}개 판매`, detail)
    add(date, { ...row, title: `조각 ${count.toLocaleString('ko-KR')}개 판매`, icon: FRAGMENT_ICON })
  }
  for (const [date, list] of Map.groupBy(clearDocs, c => c.date)) {
    const names = [...new Set(list.map(c => c.name))]
    add(date, grouped(`boss:${date}`, 'boss', list.map(c => ({ label: `${c.name} · ${bossName(c.bossId, c.difficulty)}`, amount: clearMeso({ meso: c.meso, loot: bossLootOf(c) }), ref: { kind: 'clear' as const, id: c._id.toHexString() } })), n => `보스 ${n}마리`, names.join(' · ')))
  }
  // 직접 적은 장비 줄은 아이콘이 없을 수 있어 아이콘 사전에서 같은 이름을 찾는다
  const known = await lookupItems(itemEvents.filter(e => !e.icon).map(e => e.name))
  const iconOf = (e: (typeof itemEvents)[number]) => e.icon ?? known.get(iconKey(e.name))?.icon ?? null
  for (const [date, list] of Map.groupBy(itemEvents, e => e.date)) {
    add(date, grouped(`item:${date}`, 'item', list.map(e => ({ label: `${e.name} ${ITEM_KIND_LABELS[e.kind]}`, amount: e.amount, icon: iconOf(e) })), n => `장비 ${n}건`, '장비 결산에 적은 금액'))
  }
  for (const entry of await toMesoEntries(entryDocs)) {
    const info = findMesoEntryType(entry.type)
    const rate = entry.cash && entry.amount ? `1억당 ${Math.round(entry.cash / (entry.amount / 1e8)).toLocaleString('ko-KR')}원` : ''
    const detail = [entry.item, rate, entry.memo].filter(Boolean).join(' · ')
    add(entry.date, { key: `entry:${entry.id}`, kind: 'entry', title: info?.label ?? '직접 등록', detail: detail || '직접 등록', amount: mesoEntryDelta(entry), balance: null, icon: entry.icon, children: [], ref: { kind: 'entry', id: entry.id }, entry })
  }

  // 잔액은 맞춘 날의 시작 금액에서 날짜순·종류순으로 쌓는다
  const dates = [...byDate.keys()]
  let running = balanceDate && balance !== null ? balance : null
  const series: { date: string, balance: number }[] = []
  const days: MesoHistoryDay[] = []
  if (balanceDate && !byDate.has(balanceDate) && balanceDate >= from && balanceDate <= to) dates.push(balanceDate)
  dates.sort()
  for (const date of dates) {
    const rows = (byDate.get(date) ?? []).sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind))
    const counted = running !== null && !!balanceDate && date >= balanceDate
    for (const row of rows) {
      if (counted) {
        running! += row.amount
        row.balance = running
      }
    }
    if (date === balanceDate && balance !== null) rows.unshift({ key: `base:${date}`, kind: 'base', title: `보유 메소를 ${formatKoreanNumber(balance)}으로 맞춤`, detail: '이날 시작할 때 금액이에요. 이보다 앞 기록은 잔액을 알 수 없어요', amount: 0, balance, icon: null, children: [], ref: null, entry: null })
    if (date < from) continue
    days.push({ date, net: sum(rows), rows: rows.reverse() })
  }

  // 그래프는 날마다 그날 끝 잔액이고, 기록 없는 날은 전날 그대로다
  if (balanceDate && balance !== null) {
    const endOf = new Map(days.map(d => [d.date, d.rows[0]?.balance ?? null]))
    let last = balance
    // 기간 시작 전까지 쌓인 잔액
    for (const date of dates) if (date < from && date >= balanceDate) last = (byDate.get(date) ?? []).reduce((n, r) => (r.balance ?? n), last)
    for (let d = from > balanceDate ? from : balanceDate; d <= to; d = addDays(d, 1)) {
      last = endOf.get(d) ?? last
      series.push({ date: d, balance: last })
    }
  }

  const totals: MesoHistoryResponse['totals'] = { income: 0, spent: 0, byKind: {} }
  for (const day of days) {
    for (const row of day.rows) {
      if (row.kind === 'base') continue
      const k = totals.byKind[row.kind] ?? (totals.byKind[row.kind] = { income: 0, spent: 0 })
      const parts = row.children.length ? row.children : [row]
      for (const c of parts) {
        if (c.amount >= 0) {
          k.income += c.amount
          totals.income += c.amount
        }
        else {
          k.spent -= c.amount
          totals.spent -= c.amount
        }
      }
    }
  }
  days.reverse()
  return {
    from,
    to,
    balance: balanceDate && balance !== null ? { checkedAt: balanceDate, checked: balance, current: await currentBalance(userId, balanceDate, balance) } : null,
    totals,
    days,
    series,
  }
}
