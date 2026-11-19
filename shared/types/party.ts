export interface PartyTimeResponse {
  week: string
  partyName: string
  slots: number[]
  saved: boolean
  lastWeekSlots: number[]
  // 나를 뺀 제출한 파티원 중 그 칸이 가능한 사람 수
  othersCounts: number[]
  othersSubmitted: number
  members: { character: string, me: boolean, submitted: boolean }[]
}
