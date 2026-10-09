// 메소 잠재능력 재설정 비용 (2026-10-09 확인)
// 출처: 넥슨 공식 업데이트 1.2.387(2024-01-25, News/Update/737) 잠재능력, 2024-06-20(Update/746) 에디셔널. 이후 바뀐 공지 없음
// 큐브는 2024-01-25부터 메소로 살 수 없어서 메소가 드는 재설정은 이 두 가지뿐이다
export const POTENTIAL_GRADES = ['레어', '에픽', '유니크', '레전드리'] as const
export type PotentialGrade = typeof POTENTIAL_GRADES[number]

// 착용 레벨 구간: 1~159 / 160~199 / 200~249 / 250~
const LEVEL_BANDS = [160, 200, 250]
const levelBand = (level: number) => LEVEL_BANDS.filter(min => level >= min).length

// [레벨 구간][재설정 전 등급] 1회 비용(메소)
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
