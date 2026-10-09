import type { SnapshotPoint } from '#shared/types'

export interface GrowthDay extends SnapshotPoint {
  gainExp: number | null
  gainPercent: number | null
}

// API가 레벨별 필요 경험치를 주지 않으므로 그날의 누적 경험치와 퍼센트로 역산한다
function requiredExp(point: SnapshotPoint): number | null {
  return point.expRate > 0 ? point.exp / (point.expRate / 100) : null
}

function expGain(prev: SnapshotPoint, cur: SnapshotPoint): number | null {
  if (cur.level === prev.level) return cur.exp - prev.exp
  const prevRequired = requiredExp(prev)
  // 두 단계 이상 오르면 중간 레벨의 필요 경험치를 알 수 없어 계산하지 않는다
  if (cur.level !== prev.level + 1 || prevRequired === null) return null
  return prevRequired - prev.exp + cur.exp
}

export function toGrowthDays(points: SnapshotPoint[]): GrowthDay[] {
  return points.map((point, i) => {
    const prev = points[i - 1]
    if (!prev) return { ...point, gainExp: null, gainPercent: null }
    return {
      ...point,
      gainExp: expGain(prev, point),
      gainPercent: (point.level - prev.level) * 100 + point.expRate - prev.expRate,
    }
  })
}

export function summarizeGrowth(days: GrowthDay[]) {
  const first = days[0]
  const last = days.at(-1)
  if (!first || !last) return null

  const gains = days.map(d => d.gainExp).filter((g): g is number => g !== null)
  const recent = days.slice(-7).map(d => d.gainExp).filter((g): g is number => g !== null && g > 0)
  const average = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 0
  const required = requiredExp(last)

  let levelUpDate: string | null = null
  if (required !== null && average > 0) {
    levelUpDate = addDays(last.date, Math.ceil((required - last.exp) / average))
  }

  const best = days.reduce<GrowthDay | null>((top, d) => (d.gainExp ?? -1) > (top?.gainExp ?? -1) ? d : top, null)

  return {
    totalExp: gains.reduce((a, b) => a + b, 0),
    totalPercent: (last.level - first.level) * 100 + last.expRate - first.expRate,
    levelUpDate,
    bestDay: best?.gainExp ? best : null,
    combatPowerChange: first.combatPower !== null && last.combatPower !== null ? last.combatPower - first.combatPower : null,
  }
}
