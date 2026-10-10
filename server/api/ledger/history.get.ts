import type { MesoHistoryResponse } from '#shared/types'

const MAX_DAYS = 400

// 메소 내역: 고른 기간(기본 이번 달)의 들고 남과 그때의 보유 메소
export default defineEventHandler(async (event): Promise<MesoHistoryResponse> => {
  const user = requireUser(event)
  const query = getQuery(event)
  const today = kstToday()
  const to = query.to ? parseDate(query.to) : today
  const from = query.from ? parseDate(query.from) : `${to.slice(0, 7)}-01`
  if (from > to || addDays(from, MAX_DAYS) < to) throw createError({ statusCode: 400, message: '기간을 다시 골라 주세요.' })
  return mesoHistory(user._id, from, to)
})
