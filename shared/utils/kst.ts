const KST_OFFSET_MS = 9 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

// UTC로 도는 서버에서도 한국 날짜가 나오도록 오프셋을 더한 뒤 UTC 기준으로 자른다
export function kstToday(): string {
  return new Date(Date.now() + KST_OFFSET_MS).toISOString().slice(0, 10)
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
}

// 한국 날짜의 0시를 실제 시각(Date)으로
export function kstDayStart(date: string): Date {
  return new Date(Date.parse(`${date}T00:00:00Z`) - KST_OFFSET_MS)
}

export function kstYesterday(): string {
  return addDays(kstToday(), -1)
}

// 오늘 데이터는 API가 날짜 지정 조회를 받지 않으므로 어제까지만, 오래된 날짜가 먼저
export function recentKstDates(count: number): string[] {
  const end = kstYesterday()
  return Array.from({ length: count }, (_, i) => addDays(end, i - count + 1))
}
