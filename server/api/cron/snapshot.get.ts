// 매일 수집 Cron (Authorization: Bearer NUXT_CRON_SECRET)
export default defineEventHandler(() => {
  throw createError({ statusCode: 501, statusMessage: 'Not Implemented' })
})
