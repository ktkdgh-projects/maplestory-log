// 키 교체 (키 재입력 필요, 다른 기기 세션 종료)
export default defineEventHandler(() => {
  throw createError({ statusCode: 501, statusMessage: 'Not Implemented' })
})
