import type { HuntDrops } from '#shared/types'
import { DIFFICULTY_LABELS, findBoss, type BossDifficulty } from '#shared/data/bosses'
import type { DropSet } from '#shared/data/bossDrops'
import { findMesoEntryType } from '#shared/data/mesoEntries'

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

// 일요일부터 시작하고 앞뒤 빈칸은 null로 채운다
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

export const mesoEntryLabel = (type: string) => findMesoEntryType(type)?.label ?? '직접 등록'
