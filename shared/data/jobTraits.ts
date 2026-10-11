// 넥슨 API가 주지 않는 직업 특성. 나무위키 직업·스킬 문서(어빌 추천, [파이널 어택류 스킬] 표기, 소환수 판정)와 인벤 글로 채웠고(2026-10), 못 찾은 칸은 unknown
// critOver: 궁수 5차 공용 '크리티컬 리인포스'로 100% 넘은 크확이 크뎀이 되는 직업

export type TraitLevel = 'high' | 'mid' | 'low' | 'unknown'
export type TraitFlag = 'yes' | 'no' | 'unknown'
export type MainStatType = 'normal' | 'xenon' | 'demonAvenger'

export interface JobTraits {
  critOver: TraitFlag
  cooldown: TraitLevel
  buff: TraitLevel
  summon: TraitFlag
  finalAttack: TraitFlag
  stat: MainStatType
}

export interface JobTraitRow extends JobTraits {
  job: string
  group: '전사' | '마법사' | '궁수' | '도적' | '해적'
  why: string
  source: string
}

const W = 'https://namu.wiki/w/'
const row = (group: JobTraitRow['group'], job: string, critOver: TraitFlag, cooldown: TraitLevel, buff: TraitLevel, summon: TraitFlag, finalAttack: TraitFlag, why: string, page: string, stat: MainStatType = 'normal'): JobTraitRow =>
  ({ group, job, critOver, cooldown, buff, summon, finalAttack, stat, why, source: page.startsWith('http') ? page : W + encodeURIComponent(page) })

const Y = 'yes'
const N = 'no'
const U = 'unknown'

export const JOB_TRAITS: JobTraitRow[] = [
  row('궁수', '보우마스터', Y, 'mid', 'mid', N, Y, '100% 넘은 크확도 리인포스로 크뎀이 된다고 명시', '보우마스터'),
  row('궁수', '신궁', Y, 'low', 'low', N, Y, '극딜 때 불스아이와 리인포스를 같이 쓴다', '신궁(메이플스토리)/스킬'),
  row('궁수', '패스파인더', Y, 'high', 'low', N, N, '재사용은 엣지 오브 레조넌스 연계', '패스파인더(메이플스토리)'),
  row('궁수', '윈드브레이커', Y, 'mid', 'low', N, N, '리인포스 30초 안에 볼텍스 스피어 2회', '윈드브레이커(메이플스토리)'),
  row('궁수', '메르세데스', Y, 'mid', 'low', N, Y, '리인포스 때문에 크확 가치를 명시', '메르세데스(메이플스토리)'),
  row('궁수', '와일드헌터', Y, 'low', 'low', N, Y, '100% 넘은 크확도 매우 좋다고 명시', '와일드헌터'),
  row('궁수', '카인', Y, 'low', 'low', N, N, '리인포스 보유, 크확이 보스용 최고', '카인(메이플스토리)/스킬'),
  row('전사', '히어로', N, 'mid', 'low', N, Y, '극딜이 120초 쿨기, 벞지는 엔버용뿐', '히어로(메이플스토리)'),
  row('전사', '팔라딘', N, 'high', 'mid', Y, Y, '생츄어리 VI 이후 재사용 수요가 크다', '팔라딘(메이플스토리)'),
  row('전사', '다크나이트', N, 'high', 'high', Y, Y, '재사용은 비홀더 쇼크, 벞지는 다크 레조넌스', '다크나이트(메이플스토리)'),
  row('전사', '소울마스터', N, 'mid', 'mid', N, N, '벞지는 엔버용', '소울마스터'),
  row('전사', '미하일', N, 'high', 'low', N, Y, '로얄 가드 가동률 때문에 재사용 우선', '미하일(메이플스토리)'),
  row('전사', '아란', N, 'mid', 'mid', N, Y, '벞지는 사실상 엔버에만', '아란(메이플스토리)'),
  row('전사', '블래스터', N, 'low', 'low', N, Y, '차지 캔슬 평딜 위주', '블래스터(메이플스토리)'),
  row('전사', '데몬슬레이어', N, 'high', 'high', Y, N, '메타모포시스·인피니티 포스에 재사용과 벞지 적용', '데몬슬레이어(메이플스토리)'),
  row('전사', '데몬어벤져', N, 'high', 'low', N, Y, '올스탯 대신 최대 HP가 주스탯, 재사용은 실드 체이싱', '데몬어벤져', 'demonAvenger'),
  row('전사', '카이저', N, 'high', 'high', N, N, '재사용 첫 줄 고정, 벞지로 변신 시간 연장', '카이저(메이플스토리)'),
  row('전사', '아델', N, 'mid', 'low', N, N, '재사용을 어빌 2~3줄에 추천', '아델(메이플스토리)'),
  row('전사', '제로', N, 'high', 'low', N, N, '쿨 초기화 활용이 핵심', '제로(메이플스토리)'),
  row('전사', '렌', N, 'low', 'mid', N, Y, '어빌 셋째 줄은 공격력 또는 벞지', '렌(메이플스토리)'),
  row('마법사', '아크메이지(불,독)', N, 'mid', 'mid', Y, Y, '어빌 마지막 줄은 벞지와 마력 중 고른다', '아크메이지(불,독)'),
  row('마법사', '아크메이지(썬,콜)', N, 'mid', 'low', Y, Y, '인피니티 패시브화로 벞지 순위 하락', '아크메이지(썬,콜)'),
  row('마법사', '비숍', N, 'low', 'low', N, Y, '엔젤레이는 쿨이 없다', '비숍(메이플스토리)'),
  row('마법사', '플레임위자드', N, 'mid', 'mid', Y, N, '불꽃의 화신, 벞지는 엔버용', '플레임위자드'),
  row('마법사', '에반', N, 'high', 'low', Y, Y, '미르 스킬 회전에 재사용이 필요', '에반(메이플스토리)'),
  row('마법사', '루미너스', N, 'high', 'low', N, N, '재사용이 어빌 최우선', '루미너스(메이플스토리)'),
  row('마법사', '배틀메이지', N, 'low', 'low', Y, Y, '그림 리퍼·알터, 다크 제네시스 파이널 어택', '배틀메이지(메이플스토리)'),
  row('마법사', '키네시스', N, 'low', 'low', N, N, '벞지는 엔버 외에 쓸 곳이 없다', '키네시스'),
  row('마법사', '일리움', N, 'low', 'mid', N, N, '벞지는 엔버 연장', '일리움'),
  row('마법사', '라라', N, 'low', 'low', Y, N, '용맥 분출이 소환수 지속과 연동, 효율은 낮다', '라라(메이플스토리)'),
  row('마법사', '레테', N, 'high', 'high', Y, N, '이딕트 초기화에 의존, 신규라 바뀔 수 있다', '레테(메이플스토리)'),
  row('도적', '나이트로드', N, 'low', 'mid', N, N, '어빌은 보공/상추뎀/벞지 or 공격력', '나이트로드'),
  row('도적', '섀도어', N, 'low', 'low', N, N, '쿨감은 필수, 재사용 언급은 없다', '섀도어'),
  row('도적', '듀얼블레이드', N, 'high', 'mid', N, Y, '평딜기가 10~12초 쿨', '듀얼블레이드'),
  row('도적', '나이트워커', N, 'mid', 'mid', N, N, '벞지는 엔버용으로 가치 있다', '나이트워커'),
  row('도적', '팬텀', N, 'high', 'low', N, N, '재사용 10%당 템오카 VI 딜 약 13.8%', '팬텀(메이플스토리)'),
  row('도적', '카데나', N, 'high', 'low', N, N, '재사용 어빌이 1픽', '카데나'),
  row('도적', '칼리', N, 'high', 'low', N, N, '재사용이 헥스·크레센텀에 적용', '칼리(메이플스토리)'),
  row('도적', '호영', N, 'low', 'low', Y, N, '천지인 환영이 이미 고정 쿨', '호영(메이플스토리)'),
  row('도적', '제논', N, 'low', 'low', N, N, 'STR·DEX·LUK 합산이라 올스탯이 보공·방무급', '제논(메이플스토리)', 'xenon'),
  row('해적', '바이퍼', N, 'low', 'low', N, Y, '벞지·재사용 어빌 추천 없음', '바이퍼(메이플스토리)'),
  row('해적', '캡틴', N, 'high', 'low', Y, Y, '헤드샷 쿨 초기화로 재사용이 메인', '캡틴(메이플스토리)'),
  row('해적', '캐논슈터', N, 'mid', 'mid', Y, N, '설치·소환 비중이 크다', '캐논슈터'),
  row('해적', '스트라이커', N, 'low', 'mid', N, N, '어빌 의존이 낮고 엔버를 길게 쓰는 게 유리', '스트라이커(메이플스토리)'),
  row('해적', '은월', N, 'low', 'low', Y, N, '재사용은 생존기용, 솔 야누스에 소환수 지속', '은월'),
  row('해적', '메카닉', N, 'low', 'low', Y, N, '로봇·설치기가 기본 딜', '메카닉(메이플스토리)'),
  row('해적', '엔젤릭버스터', N, 'mid', 'mid', N, N, '크확 100%를 채우기도 어려워 크확 최우선', '엔젤릭버스터'),
  row('해적', '아크', N, 'high', 'low', N, N, '재사용이 1순위 첫 줄', '아크(메이플스토리)'),
]

const UNKNOWN: JobTraits = { critOver: U, cooldown: U, buff: U, summon: U, finalAttack: U, stat: 'normal' }

// 넥슨 직업 이름(character_class)으로 찾는다. 2차 전직 전 이름 등 표에 없으면 모두 unknown
export function jobTraitsOf(job: string): JobTraitRow {
  return JOB_TRAITS.find(r => r.job === job) ?? { ...UNKNOWN, job, group: '전사', why: '', source: '' }
}
