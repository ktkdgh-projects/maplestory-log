// 레다봇 시간표: 목요일부터 7일, 하루를 2시간씩 12칸으로 나눈다. 칸 번호는 요일(목=0) × 12 + 그날의 칸
export const PARTY_SLOTS_PER_DAY = 12
export const PARTY_SLOT_COUNT = 7 * PARTY_SLOTS_PER_DAY

// 그날 고른 칸을 이어진 것끼리 묶어 "18~24시, …"로 적는다. 없으면 빈 글자
export function partyDayRanges(slots: number[], day: number): string {
  const ranges: [number, number][] = []
  for (const slot of [...slots].sort((a, b) => a - b)) {
    if (Math.floor(slot / PARTY_SLOTS_PER_DAY) !== day) continue
    const s = slot % PARTY_SLOTS_PER_DAY
    const last = ranges.at(-1)
    if (last && last[1] === s) last[1] = s + 1
    else ranges.push([s, s + 1])
  }
  return ranges.map(([from, to]) => `${from * 2}~${to * 2}시`).join(', ')
}
