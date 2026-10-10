// 사냥 시간은 소재비 개수로 센다. 1개 = 30분
export const SOJAEBI_MINUTES = 30
export const SOJAEBI_MAX = 10

export function formatHuntTime(minutes: number): string {
  return minutes % SOJAEBI_MINUTES === 0 ? `소재 ${minutes / SOJAEBI_MINUTES}개` : `${minutes}분`
}
