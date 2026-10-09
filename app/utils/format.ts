const KOREAN_UNITS: [string, number][] = [['경', 1e16], ['조', 1e12], ['억', 1e8], ['만', 1e4]]

// 게임식 큰 수 표기: 123450000 → "1억 2,345만", 17157895 → "1,715만 7,895". 위에서부터 두 자리 묶음까지만
export function formatKoreanNumber(value: number): string {
  const sign = value < 0 ? '-' : ''
  let rest = Math.abs(Math.round(value))
  const parts: string[] = []
  for (const [unit, size] of [...KOREAN_UNITS, ['', 1] as [string, number]]) {
    const count = Math.floor(rest / size)
    rest %= size
    if (count) parts.push(`${count.toLocaleString('ko-KR')}${unit}`)
    if (parts.length === 2) break
  }
  return sign + (parts.join(' ') || '0')
}

// 슬롯처럼 좁은 칸용 짧은 표기: 1234567890 → "12.3억", 56780000 → "5,678만"
export function formatShortNumber(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  for (const [unit, size] of KOREAN_UNITS) {
    if (abs < size) continue
    const n = abs / size
    return sign + (n < 100 ? `${Math.floor(n * 10) / 10}${unit}` : `${Math.floor(n).toLocaleString('ko-KR')}${unit}`)
  }
  return sign + abs.toLocaleString('ko-KR')
}

export const EOK = 1e8

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

// 몇 해 전 날짜도 구분되게 연도까지 짧게: 2026-06-19 → 26/6/19
export function formatShortDate(date: string): string {
  const [y, m, d] = date.split('-')
  return `${y!.slice(2)}/${Number(m)}/${Number(d)}`
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' })
}
