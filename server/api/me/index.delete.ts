// 탈퇴: 키·가계부·강화 기록·세션 즉시 삭제 (키 재입력 필요)
export default defineEventHandler(() => {
  throw createError({ statusCode: 501, statusMessage: 'Not Implemented' })
})
