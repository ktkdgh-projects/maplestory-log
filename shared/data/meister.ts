// 장비제작 1레벨 → 명장. 출처: 인벤 웹진 명장 공략, 나무위키 전문기술, 공식 업데이트 722(하루 피로도 500)
// 회당 피로도(화살 5, 신발·숫돌 10)는 공지에 없는 블로그 수치라 화면에 '추정'으로 적는다

export type MeisterMaterialKey = 'silver' | 'bronze' | 'aquamarine' | 'blackCrystal' | 'polish' | 'timeStone' | 'crystalHigh' | 'crystalTop' | 'twistedEssence' | 'spellEssence'
// 채광이 사라져 재료는 경매장에서 사고(buy), 연마제만 NPC에서 산다(shop)
export type MeisterSource = 'buy' | 'shop'

export interface MeisterMaterial { key: MeisterMaterialKey, name: string, icon: string, source: MeisterSource }
// until: 이 아이템을 만들어 올릴 목표 등급. 손재주로 숙련도가 두 배로 들어오면 count보다 적게 만들어도 닿는다
export interface MeisterCraft { name: string, icon: string, count: number, until: string, materials: { key: MeisterMaterialKey, each: number }[] }
export interface MeisterStage { key: 'arrow' | 'shoes' | 'whetstone', title: string, short: string, range: string, fatigue: number, crafts: MeisterCraft[], note: string }

export const MEISTER_DAILY_FATIGUE = 500
// 무한의 피로회복제 1개가 줄여 주는 피로도. 코인샵에서 하루 5개까지 산다(나무위키 코인)
export const MEISTER_POTION_FATIGUE = 70
export const MEISTER_POTION_DAILY_LIMIT = 5

// 장보기에 보이는 순서. 경매장 재료 먼저, NPC 재료는 뒤에
export const MEISTER_MATERIALS: MeisterMaterial[] = [
  { key: 'silver', name: '은', icon: 'silver-ingot', source: 'buy' },
  { key: 'bronze', name: '청동', icon: 'bronze', source: 'buy' },
  { key: 'aquamarine', name: '아쿠아마린', icon: 'aquamarine', source: 'buy' },
  { key: 'blackCrystal', name: '흑수정', icon: 'black-crystal', source: 'buy' },
  { key: 'crystalHigh', name: '상급 아이템 결정', icon: 'item-crystal-high', source: 'buy' },
  { key: 'crystalTop', name: '최상급 아이템 결정', icon: 'item-crystal-top', source: 'buy' },
  { key: 'spellEssence', name: '상급 주문의 정수', icon: 'spell-essence-high', source: 'buy' },
  { key: 'timeStone', name: '시간의 돌', icon: 'time-stone', source: 'buy' },
  { key: 'twistedEssence', name: '뒤틀린 시간의 정수', icon: 'twisted-time-essence', source: 'buy' },
  { key: 'polish', name: '고급 연마제', icon: 'polish-high', source: 'shop' },
]

export const MEISTER_STAGES: MeisterStage[] = [
  {
    key: 'arrow',
    title: '화살 만들기',
    short: '화살',
    range: 'Lv 1 → 10',
    fatigue: 5,
    note: '활전용 강한 화살(아다만티움)보다 석궁전용(청동)이 싸다',
    crafts: [
      { name: '활전용 좋은 화살', icon: 'arrow-bow-good', count: 12, until: 'Lv 4', materials: [{ key: 'silver', each: 1 }] },
      { name: '석궁전용 강한 화살', icon: 'arrow-crossbow-strong', count: 37, until: 'Lv 7', materials: [{ key: 'bronze', each: 1 }] },
      { name: '석궁전용 날카로운 화살', icon: 'arrow-crossbow-sharp', count: 77, until: 'Lv 10', materials: [{ key: 'aquamarine', each: 1 }] },
    ],
  },
  {
    key: 'shoes',
    title: '타임리스 신발',
    short: '신발',
    range: '10 → 장인',
    fatigue: 10,
    note: '수강료 100만 메소 · 망토(문라이트)보다 재료가 반쯤 든다',
    crafts: [
      { name: '타임리스 카바티나', icon: 'timeless-cavatina', count: 33, until: '장인', materials: [{ key: 'blackCrystal', each: 2 }, { key: 'polish', each: 1 }, { key: 'timeStone', each: 1 }, { key: 'crystalHigh', each: 2 }] },
    ],
  },
  {
    key: 'whetstone',
    title: '마법의 숫돌',
    short: '숫돌',
    range: '장인 → 명장',
    fatigue: 10,
    note: '30회면 숙련도가 280 모자라 31회',
    crafts: [
      { name: '마법의 숫돌', icon: 'magic-whetstone', count: 31, until: '명장', materials: [{ key: 'crystalTop', each: 10 }, { key: 'twistedEssence', each: 10 }, { key: 'spellEssence', each: 10 }] },
    ],
  },
]
