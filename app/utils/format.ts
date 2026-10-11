const EOK = 1e8

// 엑셀에서 쓰던 방식 그대로 억 단위 소수 둘째 자리까지: 15103000000 → "151.03"
export function formatEok(meso: number): string {
  return (Math.round((meso / EOK) * 100) / 100).toLocaleString('ko-KR', { maximumFractionDigits: 2 })
}

export function formatSigned(value: number, format: (n: number) => string = formatKoreanNumber): string {
  return (value > 0 ? '+' : '') + format(value)
}

export function formatSignedPercent(value: number): string {
  return formatSigned(value, n => `${n.toFixed(2)}%`)
}

export function formatMonthDay(date: string): string {
  const [, month, day] = date.split('-')
  return `${Number(month)}/${Number(day)}`
}

// 올해면 10/10, 다른 해면 2025년 10/10
export function formatDay(date: string): string {
  return date.slice(0, 4) === kstToday().slice(0, 4) ? formatMonthDay(date) : `${date.slice(0, 4)}년 ${formatMonthDay(date)}`
}

export function formatDayWeek(date: string): string {
  return `${formatDay(date)} (${WEEKDAYS[kstWeekday(date)]})`
}

export function dayLabel(day: { date: string, isToday: boolean }): string {
  return day.isToday ? '오늘' : formatDay(day.date)
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' })
}
