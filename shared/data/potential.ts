// 출처(2026-10-10 확인): 비용은 공식 Update/737(윗잠)·746(에디), 확률·천장은 Guide/OtherProbability/cube/{black|red|addi}·Update/746
export const POTENTIAL_GRADES = ['레어', '에픽', '유니크', '레전드리'] as const
export type PotentialGrade = typeof POTENTIAL_GRADES[number]

const LEVEL_BANDS = [160, 200, 250]
const levelBand = (level: number) => LEVEL_BANDS.filter(min => level >= min).length

// [레벨 구간][재설정 전 등급] 1회 비용. 큐브는 2024-01-25부터 메소로 못 사서 메소가 드는 건 메소 재설정뿐이다
const RESET_COST = {
  potential: [
    [4_000_000, 16_000_000, 34_000_000, 40_000_000],
    [4_250_000, 17_000_000, 36_125_000, 42_500_000],
    [4_500_000, 18_000_000, 38_250_000, 45_000_000],
    [5_000_000, 20_000_000, 42_500_000, 50_000_000],
  ],
  additional: [
    [9_750_000, 27_300_000, 66_300_000, 78_000_000],
    [10_375_000, 29_050_000, 70_550_000, 83_000_000],
    [11_000_000, 30_800_000, 74_800_000, 88_000_000],
    [12_250_000, 34_300_000, 83_300_000, 98_000_000],
  ],
}

export function resetCost(additional: boolean, level: number, grade: PotentialGrade): number {
  return RESET_COST[additional ? 'additional' : 'potential'][levelBand(level)]![POTENTIAL_GRADES.indexOf(grade)]!
}

export interface ResetMethod {
  id: 'meso' | 'meso-addi' | 'black' | 'red' | 'addi'
  label: string
  // 공식 옵션 확률표를 찾을 때 쓰는 큐브 아이템 id. 메소 재설정은 같은 표를 쓰는 큐브 id
  cubeItemId: number
  additional: boolean
  meso: boolean
  // 레어→에픽, 에픽→유니크, 유니크→레전드리 (%)
  tierUp: number[]
  // 같은 등급에서 이 횟수째 돌리면 등급이 반드시 오른다. 재설정 방식·등급별로 따로 쌓이고 월드 안 캐릭터끼리 공유
  ceiling: number[]
}

export const RESET_METHODS: ResetMethod[] = [
  { id: 'meso', label: '메소 재설정', cubeItemId: 5062010, additional: false, meso: true, tierUp: [15.0000001275, 3.5, 1.4], ceiling: [10, 42, 107] },
  { id: 'black', label: '블랙 큐브', cubeItemId: 5062010, additional: false, meso: false, tierUp: [15.0000001275, 3.5, 1.4], ceiling: [10, 42, 107] },
  { id: 'red', label: '레드 큐브', cubeItemId: 5062009, additional: false, meso: false, tierUp: [6.0000002444, 1.8, 0.3], ceiling: [25, 83, 500] },
  { id: 'meso-addi', label: '메소 재설정', cubeItemId: 5062500, additional: true, meso: true, tierUp: [2.381, 0.9804, 0.7], ceiling: [62, 152, 214] },
  { id: 'addi', label: '에디셔널 · 화이트 에디셔널 큐브', cubeItemId: 5062500, additional: true, meso: false, tierUp: [4.7619, 1.9608, 0.7], ceiling: [31, 76, 214] },
]

// 공식 확률표의 장비 분류 코드 = 순서 + 1
export const POTENTIAL_PARTS = [
  '무기', '엠블렘', '보조무기 (포스실드·소울링 제외)', '포스실드 · 소울링', '방패', '모자', '상의', '한벌옷', '하의', '신발',
  '장갑', '망토', '벨트', '어깨장식', '얼굴장식', '눈장식', '귀고리', '반지', '펜던트', '기계심장',
] as const

// 공식 확률표 검색이 받는 최대 장비 레벨
export const OPTION_TABLE_MAX_LEVEL = 250

// 세 줄 안에 같은 종류가 몇 개까지 나올 수 있는지 (공식 확률 페이지 안내)
export const OPTION_LIMITS: { pattern: RegExp, max: number }[] = [
  { pattern: /쓸만한/, max: 1 },
  { pattern: /피격 후 무적시간/, max: 1 },
  { pattern: /데미지의 \d+% 무시/, max: 2 },
  { pattern: /피격 시 .*무적/, max: 2 },
]
