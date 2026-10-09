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

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' })
}
