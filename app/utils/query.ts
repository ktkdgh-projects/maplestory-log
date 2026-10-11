import type { LocationQuery } from 'vue-router'

export const queryText = (query: LocationQuery, key: string) => (typeof query[key] === 'string' ? query[key] : '')

// 주소로 받은 날짜는 형식이 맞고 오늘을 넘지 않을 때만 쓴다
export function queryDate(query: LocationQuery, today: string): string | null {
  const date = queryText(query, 'date')
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= today ? date : null
}
