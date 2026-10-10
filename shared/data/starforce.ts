// 스타포스 확률·비용 (일반 장비, 2026-10-10 확인)
// 15~29성 기본 확률·실패 시 유지·파괴방지 200%: 넥슨 공식 1.2.401(2025-03-20, News/Update/767)
// 스타캐치 삭제·성공 보너스 항상 적용, 파괴 시 흔적은 직전 성급(23성 이상은 22성): 공식 1.2.413(2026-03-19, News/Update/799)
// 0~14성 확률, 스타캐치 보너스 수치(성공 ×1.05), 비용 공식·제수·반올림, 할인 합산 방식은 공식 발표가 없어 나무위키·maplestorywiki 기준(두 곳 일치)

// 스타캐치 보너스가 붙기 전 기본 확률 (성공, 파괴) %. 나머지는 실패(유지)
const BASE_RATES: [number, number][] = [
  [95, 0], [90, 0], [85, 0], [85, 0], [80, 0], [75, 0], [70, 0], [65, 0], [60, 0], [55, 0],
  [50, 0], [45, 0], [40, 0], [35, 0], [30, 0],
  [30, 2.1], [30, 2.1], [15, 6.8], [15, 6.8], [15, 8.5], [30, 10.5], [15, 12.75], [15, 17],
  [10, 18], [10, 18], [10, 18], [7, 18.6], [5, 19], [3, 19.4], [1, 19.8],
]
// 이 성급 아래 확률은 공식 표가 없어 위키 값이다
export const OFFICIAL_RATE_FROM = 15

// 스타캐치 성공 보너스(지금은 항상 적용): 성공 ×1.05, 파괴는 남은 몫에 비례해 줄인다
const CATCH_BONUS = 1.05

export interface StarRates {
  success: number
  fail: number
  destroy: number
}

// star성에서 한 번 눌렀을 때의 확률(0~1)
export function starRates(star: number): StarRates {
  const [s, d] = BASE_RATES[star]!
  const success = Math.min(100, s * CATCH_BONUS) / 100
  const destroy = d ? (d / 100) * (1 - success) / (1 - s / 100) : 0
  return { success, destroy, fail: 1 - success - destroy }
}

// 착용 레벨별 최대 성급 (공식 가이드 Articles/412)
export function maxStars(level: number): number {
  if (level >= 138) return 30
  if (level >= 128) return 20
  if (level >= 118) return 15
  if (level >= 108) return 10
  if (level >= 95) return 8
  return 5
}

// 1회 비용 = 1000 + L³ × (S+1)^지수 / 제수, 십의 자리에서 반올림
const DIVISORS: Record<number, number> = { 10: 571, 11: 314, 12: 214, 13: 157, 14: 107, 15: 200, 16: 200, 17: 150, 18: 70, 19: 45, 20: 200, 21: 125 }
// 2025-03-20 개편 전에는 17~19성·21성도 200으로 나눴다
export const STARFORCE_REVAMP_DATE = '2025-03-20'
const LEGACY_STARS = [17, 18, 19, 21]

export function baseCost(level: number, star: number, legacy = false): number {
  const divisor = legacy && LEGACY_STARS.includes(star) ? 200 : DIVISORS[star] ?? 200
  const raw = star < 10
    ? 1000 + (level ** 3 * (star + 1)) / 36
    : 1000 + (level ** 3 * (star + 1) ** 2.7) / divisor
  return Math.round(raw / 100) * 100
}

// 파괴 방지는 15·16·17성 시도에서 쓸 수 있고 기본 비용의 200%가 더 붙는다(할인 없음)
export const PROTECT_STARS = [15, 16, 17]
export const PROTECT_EXTRA = 2

// MVP·PC방 할인은 17성까지(16→17 시도까지). 슈페리얼 제외 (공식 1.2.402, Update/768)
export const DISCOUNT_MAX_STAR = 16
export const MVP_DISCOUNTS = [
  { label: '없음', rate: 0 },
  { label: '실버 3%', rate: 0.03 },
  { label: '골드 5%', rate: 0.05 },
  { label: '다이아·레드 10%', rate: 0.1 },
] as const
export const PC_DISCOUNT = 0.05

// 썬데이 이벤트 효과: 비용 30% 할인 / 5·10·15성 100% 성공 / 21성 이하 파괴 확률 30% 감소(21→22 시도 포함)
export const EVENT_DISCOUNT = 0.3
export const SURE_STARS = [5, 10, 15]
export const LESS_DESTROY = { maxStar: 21, rate: 0.3 }

// 파괴 후 흔적 성급: 22성까지는 그대로, 23성 이상은 22성
export const TRACE_MAX = 22
export const traceStar = (star: number) => Math.min(star, TRACE_MAX)

// 흔적 복구에 드는 같은 장비 개수 (공식 가이드 Articles/412). 같은 장비 1개만 내면 12성으로 복구된다
export const restoreCopies = (star: number) => (star <= 18 ? 1 : star <= 20 ? 2 : star === 21 ? 3 : 4)
export const BASE_RESTORE_STAR = 12

// 흔적 복구 메소 (2026-10-10 확인). 공식 표가 없어, 샤이닝 스타포스(비용 30% 할인·21성 이하 파괴 30%↓)에
// 15~17성 파괴방지를 쓰고 12성에서 그 성급까지 올리는 기대 메소로 맞춘 값이다. 이 규칙이 커뮤니티 표 32칸
// (나무위키·mesu.live, 140·160·200·250제)과 게임 화면(160제 22성 124억)에 모두 맞는다. 게임은 유효숫자 3자리로 올려 보여준다
export function restoreFee(level: number, star: number): number {
  let fee = 0
  for (let s = BASE_RESTORE_STAR; s < star; s++) {
    const { success, destroy } = starRates(s)
    const protect = PROTECT_STARS.includes(s)
    const base = baseCost(level, s)
    const cost = base * (1 - EVENT_DISCOUNT) + (protect ? base * PROTECT_EXTRA : 0)
    const lessDestroy = protect ? 0 : destroy * (s <= LESS_DESTROY.maxStar ? 1 - LESS_DESTROY.rate : 1)
    fee += (cost + lessDestroy * fee) / success
  }
  if (!fee) return 0
  const unit = 10 ** (Math.floor(Math.log10(fee)) - 2)
  return Math.ceil(fee / unit) * unit
}

// 샤이닝 스타포스 때 흔적 복구 메소 20% 할인 (이벤트 공지 이미지, 2026-03-20)
export const RESTORE_EVENT_DISCOUNT = 0.2

// 썬데이 메이플에 붙는 스타포스 효과. 공지가 이미지라 운영자가 그 주 효과를 골라 두면 계산기가 켠다
export const SUNDAY_STARFORCE_EFFECTS = [
  { key: 'discount', label: '스타포스 비용 30% 할인' },
  { key: 'sure', label: '5·10·15성 100% 성공' },
  { key: 'lessDestroy', label: '21성 이하 파괴 확률 30% 감소' },
  { key: 'restoreDiscount', label: '흔적 복구 메소 20% 할인' },
] as const
