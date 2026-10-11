import type { MesoHistoryResponse } from '#shared/types'

const MAX_DAYS = 400

export default defineEventHandler(async (event): Promise<MesoHistoryResponse> => {
  const user = requireUser(event)
  const query = getQuery(event)
  const today = kstToday()
  const to = query.to ? parseDate(query.to) : today
  const from = query.from ? parseDate(query.from) : `${to.slice(0, 7)}-01`
  if (from > to || addDays(from, MAX_DAYS) < to) throw createError({ statusCode: 400, message: '기간을 다시 골라 주세요.' })
  return mesoHistory(user._id, from, to)
})
