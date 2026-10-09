import { addDays } from '../utils/kst'

// 강렬한 힘의 결정 판매가 (메소, 1인 기준). 2026-09-17 패치 + 검은 마법사는 2026-10-01 적용분
// 출처: 나무위키 「강렬한 힘의 결정」, 메덕후 결정석 가격표, maple.ai.kr 9/17 조정 정리 (2026-10-09 확인, 서로 다른 값은 두 곳 이상 일치하는 값을 씀)
// 시그너스·하드 힐라·카오스 핑크빈은 9/17부터 일간 보스라 뺐다
export const BOSS_PRICE_DATE = '2026-10-01'

// 9/17 패치로 주간 결정 판매 개수 제한은 사라졌고 캐릭터당 주간 보스 처치만 12회로 남았다
export const WEEKLY_BOSS_LIMIT = 12
export const MAX_BOSS_CHARACTERS = 6
export const MAX_PARTY = 6

export type BossDifficulty = 'easy' | 'normal' | 'hard' | 'chaos' | 'extreme'

export const DIFFICULTY_LABELS: Record<BossDifficulty, string> = {
  easy: '이지',
  normal: '노멀',
  hard: '하드',
  chaos: '카오스',
  extreme: '익스트림',
}

export interface BossInfo {
  id: string
  name: string
  cycle: 'weekly' | 'monthly'
  prices: Partial<Record<BossDifficulty, number>>
}

// 센 보스부터: 넥슨 2026 소울웨폰 개편 안내의 단계(유피테르 4 > 발드릭스·림보 3 > 벨로나·흉성 2), 그 아래는 나온 순서의 역순
export const BOSSES: BossInfo[] = [
  { id: 'jupiter', name: '유피테르', cycle: 'weekly', prices: { normal: 1_560_000_000, hard: 4_845_000_000 } },
  { id: 'baldrix', name: '발드릭스', cycle: 'weekly', prices: { normal: 1_320_000_000, hard: 3_078_000_000 } },
  { id: 'limbo', name: '림보', cycle: 'weekly', prices: { normal: 995_000_000, hard: 2_385_000_000 } },
  { id: 'bellona', name: '벨로나', cycle: 'weekly', prices: { easy: 396_000_000, normal: 824_000_000, hard: 2_950_000_000 } },
  { id: 'star', name: '찬란한 흉성', cycle: 'weekly', prices: { normal: 593_000_000, hard: 2_678_000_000 } },
  { id: 'kaling', name: '카링', cycle: 'weekly', prices: { easy: 320_000_000, normal: 576_000_000, hard: 1_560_000_000, extreme: 5_387_000_000 } },
  { id: 'adversary', name: '최초의 대적자', cycle: 'weekly', prices: { easy: 261_000_000, normal: 532_000_000, hard: 1_390_000_000, extreme: 4_712_000_000 } },
  { id: 'kalos', name: '칼로스', cycle: 'weekly', prices: { easy: 238_000_000, normal: 479_000_000, chaos: 1_230_000_000, extreme: 4_104_000_000 } },
  { id: 'seren', name: '세렌', cycle: 'weekly', prices: { normal: 167_000_000, hard: 302_000_000, extreme: 1_840_000_000 } },
  { id: 'dunkel', name: '듄켈', cycle: 'weekly', prices: { normal: 23_700_000, hard: 89_600_000 } },
  { id: 'hilla', name: '진 힐라', cycle: 'weekly', prices: { normal: 67_600_000, hard: 100_000_000 } },
  { id: 'dusk', name: '더스크', cycle: 'weekly', prices: { normal: 22_000_000, chaos: 66_300_000 } },
  { id: 'will', name: '윌', cycle: 'weekly', prices: { easy: 16_100_000, normal: 20_500_000, hard: 73_200_000 } },
  { id: 'lucid', name: '루시드', cycle: 'weekly', prices: { easy: 14_900_000, normal: 17_800_000, hard: 59_700_000 } },
  { id: 'slime', name: '가디언 엔젤 슬라임', cycle: 'weekly', prices: { normal: 12_700_000, chaos: 71_300_000 } },
  { id: 'damien', name: '데미안', cycle: 'weekly', prices: { normal: 8_750_000, hard: 46_400_000 } },
  { id: 'lotus', name: '스우', cycle: 'weekly', prices: { normal: 8_350_000, hard: 48_900_000, extreme: 545_000_000 } },
  { id: 'papulatus', name: '파풀라투스', cycle: 'weekly', prices: { chaos: 6_550_000 } },
  { id: 'vellum', name: '벨룸', cycle: 'weekly', prices: { chaos: 4_640_000 } },
  { id: 'magnus', name: '매그너스', cycle: 'weekly', prices: { hard: 4_280_000 } },
  { id: 'pierre', name: '피에르', cycle: 'weekly', prices: { chaos: 4_080_000 } },
  { id: 'banban', name: '반반', cycle: 'weekly', prices: { chaos: 4_070_000 } },
  { id: 'queen', name: '블러디퀸', cycle: 'weekly', prices: { chaos: 4_070_000 } },
  { id: 'zakum', name: '자쿰', cycle: 'weekly', prices: { chaos: 4_040_000 } },
  { id: 'blackmage', name: '검은 마법사', cycle: 'monthly', prices: { hard: 465_000_000, extreme: 5_680_000_000 } },
]

export function findBoss(id: string): BossInfo | undefined {
  return BOSSES.find(b => b.id === id)
}

export function bossOrder(id: string): number {
  return BOSSES.findIndex(b => b.id === id)
}

// 파티원 수로 1/n 나누고 소수점은 버린다
export function crystalPrice(bossId: string, difficulty: string, party: number): number | null {
  const price = findBoss(bossId)?.prices[difficulty as BossDifficulty]
  return price === undefined ? null : Math.floor(price / Math.max(1, party))
}

// 주간 보스는 매주 목요일 0시(KST), 월간 보스는 매달 1일에 초기화된다
export function bossPeriod(cycle: BossInfo['cycle'], date: string): string {
  if (cycle === 'monthly') return `${date.slice(0, 7)}-01`
  const day = new Date(`${date}T00:00:00Z`).getUTCDay()
  return addDays(date, -((day + 7 - 4) % 7))
}
