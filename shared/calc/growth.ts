import type { SnapshotPoint } from '#shared/types'
import { addDays } from '#shared/utils/kst'

export interface GrowthDay extends SnapshotPoint {
  gainExp: number | null
  gainPercent: number | null
  levelUp: boolean
  isToday: boolean
}

// API가 레벨별 필요 경험치를 주지 않으므로 그날의 누적 경험치와 퍼센트로 역산한다
function requiredExp(point: SnapshotPoint): number | null {
  return point.expRate > 0 ? point.exp / (point.expRate / 100) : null
}

const percentGain = (from: SnapshotPoint, to: SnapshotPoint) => (to.level - from.level) * 100 + to.expRate - from.expRate

function expGain(prev: SnapshotPoint, cur: SnapshotPoint): number | null {
  if (cur.level === prev.level) return cur.exp - prev.exp
  const prevRequired = requiredExp(prev)
  // 두 단계 이상 오르면 중간 레벨의 필요 경험치를 알 수 없어 계산하지 않는다
  if (cur.level !== prev.level + 1 || prevRequired === null) return null
  return prevRequired - prev.exp + cur.exp
}

export function toGrowthDays(points: SnapshotPoint[], today: SnapshotPoint | null): GrowthDay[] {
  const all = today && today.date !== points.at(-1)?.date ? [...points, today] : points
  return all.map((point, i) => {
    const prev = all[i - 1]
    const isToday = point === today
    if (!prev) return { ...point, gainExp: null, gainPercent: null, levelUp: false, isToday }
    return {
      ...point,
      gainExp: expGain(prev, point),
      gainPercent: percentGain(prev, point),
      levelUp: point.level > prev.level,
      isToday,
    }
  })
}

export function summarizeGrowth(days: GrowthDay[]) {
  const first = days[0]
  const last = days.at(-1)
  if (!first || !last) return null

  const gains = days.map(d => d.gainExp).filter((g): g is number => g !== null)
  // 오늘은 아직 진행 중이라 평균에서 뺀다
  const recent = days.filter(d => !d.isToday).slice(-7).map(d => d.gainExp).filter((g): g is number => g !== null && g > 0)
  const average = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 0
  const required = requiredExp(last)

  let levelUpDate: string | null = null
  if (required !== null && average > 0) {
    levelUpDate = addDays(last.date, Math.ceil((required - last.exp) / average))
  }

  const finished = days.filter(d => !d.isToday && d.gainExp !== null)
  const topDays = [...finished].sort((a, b) => b.gainExp! - a.gainExp!).slice(0, 3)
  const powers = days.filter((d): d is GrowthDay & { combatPower: number } => d.combatPower !== null)
  const strongest = powers.reduce<typeof powers[number] | null>((top, d) => (!top || d.combatPower > top.combatPower ? d : top), null)
  const weakest = powers.reduce<typeof powers[number] | null>((low, d) => (!low || d.combatPower < low.combatPower ? d : low), null)

  return {
    totalExp: gains.reduce((a, b) => a + b, 0),
    totalPercent: percentGain(first, last),
    averagePercent: finished.length ? finished.reduce((sum, d) => sum + (d.gainPercent ?? 0), 0) / finished.length : 0,
    activeDays: finished.filter(d => d.gainExp! > 0).length,
    trackedDays: finished.length,
    levelUpDays: days.filter(d => d.levelUp),
    levelUpDate,
    averageExp: average,
    remainingExp: required === null ? null : required - last.exp,
    remainingPercent: 100 - last.expRate,
    bestDay: topDays[0]?.gainExp ? topDays[0] : null,
    topDays: topDays.filter(d => d.gainExp! > 0),
    combatPowerChange: first.combatPower !== null && last.combatPower !== null ? last.combatPower - first.combatPower : null,
    combatPowerFirst: first.combatPower,
    combatPowerLast: last.combatPower,
    strongest,
    weakest,
  }
}
