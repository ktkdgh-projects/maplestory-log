export interface KeyGatePoint {
  title: string
  text: string
  // tokens.css 색 이름
  tone: 'exp' | 'api' | 'gain' | 'gold' | 'calc' | 'loss'
}

export interface KeyGateInfo {
  title: string
  accent: 'gold' | 'blue' | 'purple' | 'green' | 'red'
  // 말풍선. 한 줄에 안 들어가면 줄 길이를 고르게 나눠 감싼다
  lead: string
  points: KeyGatePoint[]
}

// 키가 필요한 페이지에 로그아웃 상태로 왔을 때 보여 줄 페이지 소개
export const KEY_GATES = {
  history: {
    title: '메소 내역',
    accent: 'gold',
    lead: '메소가 들어오고 나간 모든 기록과 그때의 보유 메소를 한눈에 보여 드려요.',
    points: [
      { title: '보유 메소', text: '맞춘 날부터 모든 기록을 더하고 빼서 지금 보유 메소', tone: 'gold' },
      { title: '날짜별 내역', text: '사냥·보스·판매·장비·직접 등록을 한 줄씩, 그때의 잔액까지', tone: 'api' },
      { title: '직접 등록', text: '메소 판매·경매장 구매 같은 지출·수입도 적기', tone: 'calc' },
    ],
  },
  bosses: {
    title: '보스 수입',
    accent: 'gold',
    lead: '캐릭터별 보스 세팅을 해 두고, 잡을 때마다 체크하면 결정석 메소를 모아 드려요.',
    points: [
      { title: '주간·월간 체크', text: '캐릭터별 세팅대로 한 번에 전부 잡음', tone: 'api' },
      { title: '결정석 메소', text: '파티 인원까지 나눠서 자동 합산', tone: 'gold' },
      { title: '물욕템', text: '먹은 물욕템과 판 가격을 수수료 빼고 기록', tone: 'gain' },
    ],
  },
  days: {
    title: '일별 기록',
    accent: 'gold',
    lead: '그날 사냥한 메소와 조각, 판매를 달력에 적어 두세요.',
    points: [
      { title: '사냥 기록', text: '날짜별 사냥 메소·조각·주흔과 시간당 메소', tone: 'exp' },
      { title: '조각 판매', text: '판 개수와 가격을 수수료 빼고 정리', tone: 'gain' },
      { title: '달력 한눈에', text: '날마다 보스·장비·직접 등록까지 합친 순수익', tone: 'api' },
    ],
  },
  items: {
    title: '장비 결산',
    accent: 'red',
    lead: '장비를 사고, 강화하고, 파는 데 든 메소를 시트로 정리해 드려요.',
    points: [
      { title: '장비 불러오기', text: '캐릭터별 시트에 지금 낀 장비를 한 번에', tone: 'api' },
      { title: '강화 비용', text: '스타포스·큐브 비용을 강화 기록에서 날짜별로 채우기', tone: 'gold' },
      { title: '손익', text: '판매가는 경매장 수수료를 빼고 계산', tone: 'gain' },
    ],
  },
  starforce: {
    title: '스타포스',
    accent: 'gold',
    lead: '넥슨에 남은 내 스타포스 기록을 장비별로 모아 드려요.',
    points: [
      { title: '구간별 기록', text: '구간마다 시도·성공·파괴 횟수', tone: 'gold' },
      { title: '쓴 메소', text: '이벤트·MVP 할인·복구 비용까지 반영한 추정', tone: 'loss' },
      { title: '운', text: '구간마다 평균보다 운이 좋았는지', tone: 'calc' },
    ],
  },
  potential: {
    title: '잠재능력',
    accent: 'blue',
    lead: '큐브를 돌린 기록을 장비별로 모아 드려요.',
    points: [
      { title: '등급 상승', text: '윗잠·에디셔널 등급이 오른 순간', tone: 'calc' },
      { title: '큐브 횟수', text: '큐브 종류별로 돌린 횟수', tone: 'api' },
      { title: '옵션 흐름', text: '옵션이 바뀐 흐름을 한눈에', tone: 'gold' },
    ],
  },
  review: {
    title: '강화 결산',
    accent: 'green',
    lead: '그날 강화한 기록을 평균과 비교해서 이득인지 손해인지 알려 드려요.',
    points: [
      { title: '이득·손해', text: '장비별로 평균 대비 이득·손해 메소', tone: 'gain' },
      { title: '운', text: '1만 번 시뮬레이션 중 상위 몇 %인지', tone: 'calc' },
      { title: '썬데이 결산', text: '썬데이 기간을 한 번에 결산', tone: 'gold' },
    ],
  },
} satisfies Record<string, KeyGateInfo>
