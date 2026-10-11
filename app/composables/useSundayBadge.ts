import type { SundayResponse } from '#shared/types'

const SEEN_KEY = 'sunday-seen'

// 헤더 썬데이 메뉴 옆 표시. waiting: 발표 전, new: 발표됐는데 아직 안 봄, upcoming: 봤고 일요일 전, today: 일요일 당일
export type SundayBadge = { kind: 'waiting' } | { kind: 'new' } | { kind: 'upcoming', days: number } | { kind: 'today' }

const badgeState = () => useState<SundayBadge>('sunday-badge', () => ({ kind: 'waiting' }))
type SundayCurrent = { id: number, start: string, end: string } | null

const currentState = () => useState<SundayCurrent>('sunday-current', () => null)

function badgeOf(current: SundayCurrent, seen: string | null, now = Date.now()): SundayBadge {
  const phase = sundayPhase(now, current)
  if (!current || phase === 'waiting' || phase === 'late') return { kind: 'waiting' }
  if (phase === 'today') return { kind: 'today' }
  if (seen !== String(current.id)) return { kind: 'new' }
  return { kind: 'upcoming', days: daysUntil(now, current.start) }
}

function readSeen() {
  try {
    return localStorage.getItem(SEEN_KEY)
  }
  catch {
    return null
  }
}

// 헤더와 휴대폰 탭바가 같이 쓴다. 공지는 한 번만 받는다
export function useSundayBadge() {
  const badge = badgeState()
  const current = currentState()
  const loaded = useState('sunday-badge-loaded', () => false)
  onMounted(async () => {
    if (loaded.value) return
    loaded.value = true
    const data = await $fetch<SundayResponse>('/api/sunday').catch(() => null)
    current.value = data?.current ? { id: data.current.id, start: data.current.start, end: data.current.end } : null
    badge.value = badgeOf(current.value, readSeen())
  })
  return badge
}

// 썬데이 페이지를 열면 이번 주 공지를 봤다고 남겨 금색 점을 끈다
export function markSundaySeen(id: number) {
  try {
    localStorage.setItem(SEEN_KEY, String(id))
  }
  catch {}
  badgeState().value = badgeOf(currentState().value, String(id))
}
