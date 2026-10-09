// 스타포스 1회 비용 (일반 장비, 2026-10-09 확인)
// 공식 발표가 없어 나무위키·maplestorywiki 기준(두 곳 일치). 2025-03-20 개편(공식 1.2.401)으로 17~19성·21성 비용이 올랐다
// 1회 비용 = 1000 + L³ × (S+1)^지수 / 제수, 십의 자리에서 반올림
const DIVISORS: Record<number, number> = { 10: 571, 11: 314, 12: 214, 13: 157, 14: 107, 15: 200, 16: 200, 17: 150, 18: 70, 19: 45, 20: 200, 21: 125 }
// 개편 전에는 17~19성·21성도 200으로 나눴다
export const STARFORCE_REVAMP_DATE = '2025-03-20'
const LEGACY_STARS = [17, 18, 19, 21]

export function baseCost(level: number, star: number, legacy = false): number {
  const divisor = legacy && LEGACY_STARS.includes(star) ? 200 : DIVISORS[star] ?? 200
  const raw = star < 10
    ? 1000 + (level ** 3 * (star + 1)) / 36
    : 1000 + (level ** 3 * (star + 1) ** 2.7) / divisor
  return Math.round(raw / 100) * 100
}

// 파괴 방지를 쓰면 기본 비용의 200%가 더 붙는다 (공식 1.2.401)
export const PROTECT_EXTRA = 2
