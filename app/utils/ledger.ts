import type { BossClear, DropSale, HuntDrops, HuntEntry, ItemFlow, MesoEntry } from '#shared/types'
import { DIFFICULTY_LABELS, findBoss, type BossDifficulty } from '#shared/data/bosses'
import type { DropSet } from '#shared/data/bossDrops'

// 보스 아이콘 뒤에 깔리는 색
export const BOSS_HUES: Record<string, number> = {
  kaling: 350,
  jupiter: 45,
  adversary: 0,
  kalos: 200,
  baldrix: 25,
  bellona: 320,
  star: 270,
  limbo: 180,
  seren: 50,
  lotus: 210,
  hilla: 300,
  dunkel: 15,
  will: 240,
  slime: 140,
  dusk: 160,
  lucid: 285,
  damien: 5,
  papulatus: 100,
  vellum: 120,
  magnus: 30,
  pierre: 330,
  banban: 260,
  queen: 340,
  zakum: 20,
  blackmage: 275,
}

export const DROP_SET_TONES: Record<DropSet, string> = {
  '광휘': '#ffd36b',
  '칠흑': '#b07cff',
  '연마석': '#7fd99a',
  '시드링': '#ff8fb1',
  '여명': '#ffb36b',
  '보스 장신구': '#7fb2ff',
  '기타': '#c9b6ff',
}

export function bossLabel(bossId: string, difficulty: string): string {
  return `${DIFFICULTY_LABELS[difficulty as BossDifficulty] ?? ''} ${findBoss(bossId)?.name ?? bossId}`.trim()
}

export const HUNT_DROPS: { key: keyof HuntDrops, label: string, short: string, color: string }[] = [
  { key: 'fragments', label: '솔 에르다 조각', short: '조각', color: '#b79cff' },
  { key: 'traces', label: '주문의 흔적', short: '주흔', color: '#7fb2ff' },
]

export const DIFFICULTY_COLORS: Record<BossDifficulty, string> = {
  easy: '#8fd18f',
  normal: '#7fb2ff',
  hard: '#ff8a7a',
  chaos: '#c58bff',
  extreme: '#ffd36b',
}

export interface LedgerDay extends HuntDrops {
  huntMeso: number
  bossMeso: number
  // bossMeso·clears 중 월간 보스(검은 마법사) 몫
  bossMonthly: number
  monthlyClears: number
  saleMeso: number
  // 장비 결산에서 넘어온 지출: 구매 + 강화. itemSpent는 둘의 합
  itemBought: number
  itemEnhanced: number
  itemSpent: number
  itemEarned: number
  // 직접 등록한 지출·수입
  entryIn: number
  entryOut: number
  minutes: number
  hunts: number
  clears: number
  loot: string[]
}

const emptyDay = (): LedgerDay => ({ huntMeso: 0, bossMeso: 0, bossMonthly: 0, monthlyClears: 0, saleMeso: 0, itemBought: 0, itemEnhanced: 0, itemSpent: 0, itemEarned: 0, entryIn: 0, entryOut: 0, minutes: 0, hunts: 0, clears: 0, loot: [], fragments: 0, traces: 0 })

export const dayIncome = (d: LedgerDay) => d.huntMeso + d.bossMeso + d.saleMeso + d.itemEarned + d.entryIn
export const dayNet = (d: LedgerDay) => dayIncome(d) - d.itemSpent - d.entryOut

export function summarizeLedger(hunts: HuntEntry[], clears: BossClear[], items: ItemFlow[] = [], sales: DropSale[] = [], entries: MesoEntry[] = []) {
  const days = new Map<string, LedgerDay>()
  const total = emptyDay()
  const day = (date: string) => days.get(date) ?? days.set(date, emptyDay()).get(date)!
  for (const h of hunts) {
    for (const target of [day(h.date), total]) {
      target.huntMeso += h.meso
      target.minutes += h.minutes ?? 0
      target.hunts++
      for (const { key } of HUNT_DROPS) target[key] += h[key]
    }
  }
  for (const c of clears) {
    for (const target of [day(c.date), total]) {
      target.bossMeso += clearMeso(c)
      if (findBoss(c.bossId)?.cycle === 'monthly') {
        target.bossMonthly += clearMeso(c)
        target.monthlyClears++
      }
      target.clears++
      target.loot.push(...c.loot.map(l => l.item))
    }
  }
  for (const s of sales) {
    for (const target of [day(s.date), total]) {
      target.saleMeso += dropSaleNet(s)
    }
  }
  for (const i of items) {
    for (const target of [day(i.date), total]) {
      target.itemBought += i.bought
      target.itemEnhanced += i.enhanced
      target.itemSpent += i.bought + i.enhanced
      target.itemEarned += i.earned
    }
  }
  for (const e of entries) {
    const delta = mesoEntryDelta(e)
    for (const target of [day(e.date), total]) {
      if (delta >= 0) target.entryIn += delta
      else target.entryOut -= delta
    }
  }
  return { days, total }
}

// 달력은 일요일부터 시작해 앞뒤 빈칸을 채운 6주 이하의 칸 목록
export function calendarCells(month: string): (string | null)[] {
  const [y, m] = month.split('-').map(Number)
  const first = new Date(Date.UTC(y!, m! - 1, 1))
  const last = new Date(Date.UTC(y!, m!, 0)).getUTCDate()
  const cells: (string | null)[] = Array.from({ length: first.getUTCDay() }, () => null)
  for (let d = 1; d <= last; d++) cells.push(`${month}-${String(d).padStart(2, '0')}`)
  while (cells.length % 7) cells.push(null)
  return cells
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1 + delta, 1)).toISOString().slice(0, 7)
}

export function formatMonth(month: string): string {
  const [y, m] = month.split('-')
  return `${y}년 ${Number(m)}월`
}

export function mesoPerHour(meso: number, minutes: number): number | null {
  return minutes ? Math.round((meso / minutes) * 60) : null
}
