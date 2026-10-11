export interface SundayNotice {
  id: number
  title: string
  url: string
  // 공지 본문 이미지(넥슨 이벤트 이미지)
  image: string | null
  start: string
  end: string
  publishedAt: string
  // 운영자가 고른 그 주 스타포스 효과 키(SUNDAY_STARFORCE_EFFECTS). 아직 안 골랐으면 null, 스타포스 효과가 없는 주면 []
  effects: string[] | null
}

export interface SundayResponse {
  // 아직 끝나지 않은 가장 최근 썬데이. 없으면 null
  current: SundayNotice | null
  history: SundayNotice[]
  checkedAt: string
}
