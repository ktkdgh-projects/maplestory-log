export function errorMessage(error: unknown, fallback = '문제가 생겼어요. 잠시 후 다시 시도해 주세요.'): string {
  const data = (error as { data?: { message?: string } } | null)?.data
  return data?.message || fallback
}
