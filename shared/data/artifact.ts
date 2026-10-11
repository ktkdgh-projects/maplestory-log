// 유니온 아티팩트. 출처: 공식 업데이트 731, 나무위키 유니온 아티팩트. 효과 수치는 넥슨 API 문구와 맞춰 봤다(5레벨 = 10레벨의 절반)

export type ArtifactEffectKey = 'allStat' | 'hpMp' | 'att' | 'damage' | 'boss' | 'ied' | 'buff' | 'cooldown' | 'meso' | 'drop' | 'critRate' | 'critDmg' | 'exp' | 'status' | 'summon' | 'finalAttack'
export type ArtifactGroup = 'boss' | 'core' | 'hunt' | 'util'

export interface ArtifactEffect {
  key: ArtifactEffectKey
  name: string
  short: string
  group: ArtifactGroup
  // 10레벨 수치와 단위
  max: number
  unit: '%' | ''
  // 공백을 뺀 넥슨 문구에서 찾는 말. 앞에서부터 맞춰 본다
  match: string
}

export const ARTIFACT_MAX_LEVEL = 10

export const ARTIFACT_EFFECTS: ArtifactEffect[] = [
  { key: 'boss', name: '보스 몬스터 데미지', short: '보공', group: 'boss', max: 15, unit: '%', match: '보스몬스터' },
  { key: 'critDmg', name: '크리티컬 데미지', short: '크뎀', group: 'boss', max: 4, unit: '%', match: '크리티컬데미지' },
  { key: 'finalAttack', name: '파이널 어택류 데미지', short: '파컷', group: 'util', max: 30, unit: '%', match: '파이널어택' },
  { key: 'damage', name: '데미지', short: '데미지', group: 'boss', max: 15, unit: '%', match: '데미지' },
  { key: 'ied', name: '방어율 무시', short: '방무', group: 'core', max: 20, unit: '%', match: '방어율무시' },
  { key: 'allStat', name: '올스탯', short: '올스탯', group: 'core', max: 150, unit: '', match: '올스탯' },
  { key: 'critRate', name: '크리티컬 확률', short: '크확', group: 'core', max: 20, unit: '%', match: '크리티컬확률' },
  { key: 'att', name: '공격력/마력', short: '공마', group: 'core', max: 30, unit: '', match: '공격력' },
  { key: 'meso', name: '메소 획득량', short: '메획', group: 'hunt', max: 12, unit: '%', match: '메소' },
  { key: 'drop', name: '아이템 드롭률', short: '드롭', group: 'hunt', max: 12, unit: '%', match: '드롭' },
  { key: 'exp', name: '추가 경험치', short: '경험치', group: 'hunt', max: 12, unit: '%', match: '경험치' },
  { key: 'buff', name: '버프 지속시간', short: '벞지', group: 'util', max: 20, unit: '%', match: '버프지속' },
  { key: 'cooldown', name: '재사용 미적용', short: '재사용', group: 'util', max: 7.5, unit: '%', match: '재사용' },
  { key: 'summon', name: '소환수 지속시간', short: '소환수', group: 'util', max: 20, unit: '%', match: '소환수' },
  { key: 'hpMp', name: '최대 HP/MP', short: 'HP', group: 'util', max: 7500, unit: '', match: '최대HP' },
  { key: 'status', name: '상태이상 내성', short: '상태이상', group: 'util', max: 12, unit: '', match: '상태이상' },
]

export function artifactEffectOf(text: string): ArtifactEffect | null {
  const plain = text.replace(/\s+/g, '')
  return ARTIFACT_EFFECTS.find(e => plain.includes(e.match)) ?? null
}

// 메획·드롭·경험치·상태이상은 레벨마다 1씩, 5·10레벨에서만 2씩 오른다. 나머지는 레벨마다 같은 만큼
const STEPPED: ArtifactEffectKey[] = ['meso', 'drop', 'exp', 'status']
const STEPPED_VALUES = [0, 1, 2, 3, 4, 6, 7, 8, 9, 10, 12]
export function effectValue(effect: ArtifactEffect, level: number): number {
  const l = Math.max(0, Math.min(level, ARTIFACT_MAX_LEVEL))
  return STEPPED.includes(effect.key) ? STEPPED_VALUES[l]! : effect.max * l / ARTIFACT_MAX_LEVEL
}

// 크리스탈은 Lv 1에 3개, 그 뒤 10레벨마다 하나씩 열린다
export const ARTIFACT_CRYSTALS = [
  { name: '주황버섯', icon: 'orange-mushroom', unlock: 1 },
  { name: '슬라임', icon: 'slime', unlock: 1 },
  { name: '뿔버섯', icon: 'horny-mushroom', unlock: 1 },
  { name: '스텀프', icon: 'stump', unlock: 10 },
  { name: '스톤골렘', icon: 'stone-golem', unlock: 20 },
  { name: '발록', icon: 'balrog', unlock: 30 },
  { name: '자쿰', icon: 'zakum', unlock: 40 },
  { name: '핑크빈', icon: 'pink-bean', unlock: 50 },
  { name: '파풀라투스', icon: 'papulatus', unlock: 60 },
]
export const ARTIFACT_MAX_CRYSTAL_GRADE = 5

// 레벨마다 AP 1, 5의 배수 레벨엔 2
export const artifactAp = (level: number) => level + Math.floor(level / 5)

// 레벨업에 필요한 EXP(인덱스 = 지금 레벨). 출처: 나무위키 유니온 아티팩트(누적 열은 45레벨부터 1만 적게 적혀 있어 레벨별 값을 더해 쓴다)
export const ARTIFACT_EXP = [0, 2500, 2550, 2600, 2650, 2700, 2750, 2800, 2850, 2900, 2950, 3000, 3050, 3100, 3150, 3200, 3250, 3300, 3350, 3400, 3450, 3500, 3550, 3600, 3700, 3800, 3900, 4000, 4500, 5000, 5500, 6000, 6500, 7000, 7500, 8000, 8500, 9000, 9500, 10000, 12000, 14000, 16000, 18000, 20000, 22000, 24000, 26000, 28000, 30000, 50000, 55000, 60000, 65000, 70000, 100000, 110000, 120000, 130000, 200000]
export const ARTIFACT_TOP_LEVEL = ARTIFACT_EXP.length

// 주간 미션(목요일 초기화). 일반 미션은 몬스터 2만 마리 + 접속 4회를 다 하면 2,000, 부스터를 쓰면 일반 미션만 2배
export const ARTIFACT_NORMAL_MISSION_EXP = 2000
export const ARTIFACT_BOOSTER_WEEKS = 4
export const ARTIFACT_BOOSTER_MAX_WEEKS = 52
// 보스 미션은 월드에서 가장 높은 3개만 받는다. 키는 보스 id:난이도(shared/data/bosses)
export const ARTIFACT_BOSS_MISSIONS_COUNTED = 3
export const ARTIFACT_BOSS_EXP: Record<string, number> = {
  'zakum:chaos': 150,
  'pierre:chaos': 180, 'banban:chaos': 180, 'queen:chaos': 180,
  'magnus:hard': 200, 'vellum:chaos': 200, 'papulatus:chaos': 200,
  'lotus:normal': 250, 'damien:normal': 250, 'slime:normal': 250,
  'lucid:easy': 300, 'will:easy': 300,
  'lucid:normal': 400, 'will:normal': 400,
  'dusk:normal': 500, 'dunkel:normal': 500,
  'damien:hard': 700, 'lotus:hard': 700,
  'lucid:hard': 800, 'will:hard': 800, 'hilla:normal': 800,
  'slime:chaos': 900, 'dusk:chaos': 900,
  'dunkel:hard': 1000, 'hilla:hard': 1000,
  'seren:normal': 1200,
  'kalos:easy': 1400, 'adversary:easy': 1400,
  'kaling:easy': 1500, 'bellona:easy': 1500, 'seren:hard': 1500,
  'kalos:normal': 1800, 'adversary:normal': 1800, 'lotus:extreme': 1800,
  'star:normal': 2000, 'kaling:normal': 2000, 'bellona:normal': 2000,
  'limbo:normal': 2500,
  'baldrix:normal': 3000, 'kalos:chaos': 3000, 'jupiter:normal': 3000, 'adversary:hard': 3000,
  'kaling:hard': 3500, 'star:hard': 3500, 'bellona:hard': 3500, 'limbo:hard': 3500, 'seren:extreme': 3500,
  'kalos:extreme': 4000, 'baldrix:hard': 4000, 'adversary:extreme': 4000,
  'kaling:extreme': 4500, 'jupiter:hard': 4500,
}
