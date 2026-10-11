import type { BossClear, DropSale, HuntDrops, HuntEntry, ItemFlow, MesoEntry } from '#shared/types'
import { findBoss } from '#shared/data/bosses'
import { clearMeso } from './boss'
import { dropSaleNet, mesoEntryDelta } from './meso'

const HUNT_DROP_KEYS: (keyof HuntDrops)[] = ['fragments', 'traces']

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
      for (const key of HUNT_DROP_KEYS) target[key] += h[key]
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

export function mesoPerHour(meso: number, minutes: number): number | null {
  return minutes ? Math.round((meso / minutes) * 60) : null
}
