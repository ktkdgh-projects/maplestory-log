// waiting: 발표 전(보통 금 10시 전), late: 발표 예상 시각이 지났는데 아직 없음, announced: 발표 뒤 일요일 전, today: 일요일 당일
export type SundayPhase = 'waiting' | 'late' | 'announced' | 'today'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

// 한국 시각 기준 요일(0=일)과 그날 0시(UTC ms)
function kstDay(ms: number) {
  const shifted = ms + 9 * HOUR
  const midnight = shifted - (shifted % DAY) - 9 * HOUR
  return { weekday: new Date(shifted).getUTCDay(), midnight }
}

// now 기준 다음(오늘 포함) weekday요일 hour시
export function nextKstWeekday(now: number, weekday: number, hour: number): number {
  const { weekday: today, midnight } = kstDay(now)
  return midnight + ((weekday - today + 7) % 7) * DAY + hour * HOUR
}

// 넥슨은 끝을 23:59로 적어서 그 1분까지 넣어 월요일 0시 정각에 끝나게 한다
export const sundayEndsAt = (end: string) => Date.parse(end) + 60 * 1000

// 일요일까지 남은 날 수. 시간 차이가 아니라 한국 날짜 기준이라 매일 0시에 하나씩 줄어든다 (토요일 = 1)
export function daysUntil(now: number, start: string): number {
  return Math.round((kstDay(Date.parse(start)).midnight - kstDay(now).midnight) / DAY)
}

export function sundayPhase(now: number, current: { start: string, end: string } | null): SundayPhase {
  if (current && sundayEndsAt(current.end) > now) return Date.parse(current.start) <= now ? 'today' : 'announced'
  // 공지가 없을 때: 금요일 10시 이후 ~ 일요일이면 늦어진 것
  const { weekday } = kstDay(now)
  const hour = new Date(now + 9 * HOUR).getUTCHours()
  return (weekday === 5 && hour >= 10) || weekday === 6 || weekday === 0 ? 'late' : 'waiting'
}
