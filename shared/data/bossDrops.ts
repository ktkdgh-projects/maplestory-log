import type { BossDifficulty } from './bosses'

// 보스 물욕템 드롭표 (2026-10-09 확인)
// 출처: 넥슨 공식 가이드 「보스별 주요 보상」「보스 반지 상자」(peak 2688), 공식 패치노트 1.2.401·1.2.406·1.2.419,
// 나무위키 칠흑·광휘·여명·보스 장신구 세트, 특수 스킬 반지, 각 보스 문서
// 난이도를 비우면 그 보스의 모든 난이도에서 나온다. 교환 불가(장비 상자·단체 보상 재료)는 넣지 않았다
export type DropSet = '광휘' | '칠흑' | '연마석' | '시드링' | '여명' | '보스 장신구' | '기타'

export interface BossDrop {
  item: string
  part: string
  set: DropSet
  // app/assets/loot/<icon>.png. 없으면 상자 그림으로 대신한다
  icon?: string
  // 세트색 대신 쓸 아이콘 둘레 빛(아이콘이 없으면 상자) 색
  tone?: string
  from: { bossId: string, difficulties?: BossDifficulty[] }[]
}

type From = BossDrop['from']
const f = (bossId: string, ...difficulties: BossDifficulty[]): From[number] => (difficulties.length ? { bossId, difficulties } : { bossId })

// 보스 반지 상자(녹옥·홍옥·흑옥·백옥·생명)가 나오는 보스. 상자에서 나오는 시드링 중 거래되는 리레·컨티만 물욕템으로 둔다
const RING_BOX_BOSSES: From = [
  f('lotus'), f('damien'), f('slime'), f('lucid'), f('will'), f('dusk'), f('dunkel'), f('hilla'), f('seren'), f('blackmage'),
  f('kalos'), f('adversary'), f('kaling'), f('star'), f('bellona'), f('limbo'), f('baldrix'), f('jupiter'),
]

const BOSS_DROPS: BossDrop[] = [
  { item: '오만의 원죄', part: '얼굴장식', set: '광휘', icon: 'original-sin', from: [f('jupiter', 'hard')] },
  { item: '죽음의 맹세', part: '펜던트', set: '광휘', icon: 'oath-of-death', from: [f('baldrix', 'hard')] },
  { item: '근원의 속삭임', part: '반지', set: '광휘', icon: 'whisper-of-source', from: [f('limbo', 'hard')] },
  { item: '굶주리는 핏빛 원혼', part: '눈장식', set: '광휘', icon: 'blood-wraith', from: [f('bellona', 'hard')] },
  { item: '황홀한 악몽', part: '반지', set: '광휘', icon: 'ecstatic-nightmare', from: [f('star', 'hard')] },
  { item: '불멸의 유산', part: '훈장', set: '광휘', icon: 'immortal-legacy', from: [f('adversary', 'hard', 'extreme')] },

  // 상자 내용물은 루컨마·안대·몽벨·마도서 선택 상자·거대한 공포·커포이·고통의 근원 7종
  { item: '혼돈의 칠흑 장신구 상자', part: '상자', set: '칠흑', icon: 'chaos-pitched-box', from: [f('kaling', 'normal', 'hard', 'extreme'), f('star'), f('bellona', 'normal', 'hard'), f('limbo'), f('baldrix'), f('jupiter')] },
  { item: '미트라의 분노 선택 상자', part: '엠블렘', set: '칠흑', icon: 'mitra-rage', from: [f('seren', 'hard', 'extreme')] },
  { item: '창세의 뱃지', part: '뱃지', set: '칠흑', icon: 'genesis-badge', from: [f('blackmage', 'hard', 'extreme')] },
  { item: '커맨더 포스 이어링', part: '귀고리', set: '칠흑', icon: 'commander-earring', from: [f('dunkel', 'hard')] },
  { item: '고통의 근원', part: '펜던트', set: '칠흑', icon: 'source-of-suffering', from: [f('hilla', 'hard')] },
  { item: '거대한 공포', part: '반지', set: '칠흑', icon: 'endless-terror', from: [f('dusk', 'chaos')] },
  { item: '저주받은 마도서 선택 상자', part: '포켓', set: '칠흑', icon: 'cursed-spellbook', from: [f('will', 'hard')] },
  { item: '몽환의 벨트', part: '벨트', set: '칠흑', icon: 'dreamy-belt', from: [f('lucid', 'hard')] },
  { item: '마력이 깃든 안대', part: '눈장식', set: '칠흑', icon: 'magic-eyepatch', from: [f('damien', 'hard')] },
  { item: '루즈 컨트롤 머신 마크', part: '얼굴장식', set: '칠흑', icon: 'lcmm', from: [f('lotus', 'hard', 'extreme')] },
  { item: '컴플리트 언더컨트롤', part: '기계 심장', set: '칠흑', icon: 'complete-undercontrol', from: [f('lotus', 'extreme')] },

  // 카링 하드·익스는 2025-08-21부터 생명 대신 신념. 흉성·벨로나의 노멀=생명·하드=신념 구분은 나무위키 기준
  { item: '생명의 연마석', part: '연마석', set: '연마석', icon: 'life-whetstone', from: [f('kalos', 'normal', 'chaos', 'extreme'), f('adversary', 'normal', 'hard', 'extreme'), f('kaling', 'normal'), f('star', 'normal'), f('bellona', 'normal')] },
  { item: '신념의 연마석', part: '연마석', set: '연마석', icon: 'faith-whetstone', from: [f('kaling', 'hard', 'extreme'), f('star', 'hard'), f('bellona', 'hard'), f('limbo'), f('baldrix'), f('jupiter')] },

  { item: '리스트레인트 링', part: '반지', set: '시드링', icon: 'restraint-ring', from: RING_BOX_BOSSES },
  { item: '컨티뉴어스 링', part: '반지', set: '시드링', icon: 'continuous-ring', from: RING_BOX_BOSSES },

  { item: '트와일라이트 마크', part: '얼굴장식', set: '여명', icon: 'twilight-mark', from: [f('lucid', 'normal', 'hard'), f('will', 'normal', 'hard')] },
  { item: '에스텔라 이어링', part: '귀고리', set: '여명', icon: 'estella-earring', from: [f('dusk'), f('dunkel')] },
  { item: '데이브레이크 펜던트', part: '펜던트', set: '여명', icon: 'daybreak-pendant', from: [f('hilla'), f('seren')] },

  { item: '가디언 엔젤 링', part: '반지', set: '보스 장신구', icon: 'guardian-angel-ring', from: [f('slime')] },
  { item: '파풀라투스 마크', part: '눈장식', set: '보스 장신구', icon: 'papulatus-mark', from: [f('papulatus')] },
  { item: '분노한 자쿰의 벨트', part: '벨트', set: '보스 장신구', icon: 'zakum-belt', from: [f('zakum')] },
  { item: '응축된 힘의 결정석', part: '얼굴장식', set: '보스 장신구', icon: 'condensed-power', from: [f('zakum')] },
  { item: '아쿠아틱 레터 눈장식', part: '눈장식', set: '보스 장신구', icon: 'aquatic-eye', from: [f('zakum')] },
  { item: '크리스탈 웬투스 뱃지', part: '뱃지', set: '보스 장신구', icon: 'wentus-badge', from: [f('magnus')] },
  { item: '로얄 블랙메탈 숄더', part: '어깨장식', set: '보스 장신구', icon: 'blackmetal-shoulder', from: [f('magnus')] },

  { item: '익셉셔널 해머 (벨트)', part: '익셉셔널', set: '기타', icon: 'hammer-belt', from: [f('blackmage', 'extreme')] },
  { item: '익셉셔널 해머 (얼굴장식)', part: '익셉셔널', set: '기타', icon: 'hammer-face', from: [f('seren', 'extreme')] },
  { item: '익셉셔널 해머 (눈장식)', part: '익셉셔널', set: '기타', icon: 'hammer-eye', from: [f('kalos', 'extreme')] },
  { item: '익셉셔널 해머 (귀고리)', part: '익셉셔널', set: '기타', icon: 'hammer-earring', from: [f('kaling', 'extreme')] },
  { item: '익셉셔널 해머 (훈장)', part: '익셉셔널', set: '기타', icon: 'hammer-medal', from: [f('adversary', 'extreme')] },
  { item: '1단계 소울 에테르', part: '소울', set: '기타', icon: 'soul-ether-1', tone: '#7fd8ff', from: [f('adversary', 'normal', 'hard', 'extreme'), f('kaling', 'normal', 'hard', 'extreme')] },
  { item: '2단계 소울 에테르', part: '소울', set: '기타', icon: 'soul-ether-2', tone: '#ff9a5a', from: [f('bellona', 'normal', 'hard'), f('star')] },
  { item: '3단계 소울 에테르', part: '소울', set: '기타', icon: 'soul-ether-3', tone: '#c58bff', from: [f('limbo'), f('baldrix')] },
  { item: '4단계 소울 에테르', part: '소울', set: '기타', icon: 'soul-ether-4', tone: '#7fe0a0', from: [f('jupiter')] },
]

export function dropsOf(bossId: string, difficulty: string): BossDrop[] {
  return BOSS_DROPS.filter(d => d.from.some(src => src.bossId === bossId && (!src.difficulties || src.difficulties.includes(difficulty as BossDifficulty))))
}

export function findDrop(item: string): BossDrop | undefined {
  return BOSS_DROPS.find(d => d.item === item)
}
