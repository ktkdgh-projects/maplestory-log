export interface NavItem {
  to: string
  label: string
  hint: string
  // 아래 주소(/ledger/bosses)가 다른 메뉴인 경우 이 주소만 켠다
  exact?: boolean
}

export interface NavGroup {
  key: 'character' | 'ledger' | 'enhance' | 'calc' | 'sunday'
  label: string
  items: NavItem[]
  isNew?: boolean
}

export const NAV_GROUPS: NavGroup[] = [
  {
    key: 'character',
    label: '캐릭터',
    items: [
      { to: '/', label: '캐릭터 정보', hint: '장비·스탯·프리셋 추천' },
      { to: '/growth', label: '성장 기록', hint: '경험치·전투력 그래프' },
    ],
  },
  {
    key: 'ledger',
    label: '가계부',
    items: [
      { to: '/ledger/days', label: '일별 기록', hint: '사냥·판매 달력' },
      { to: '/ledger/bosses', label: '보스 수입', hint: '주간·월간 보스 체크와 결정석' },
      { to: '/items', label: '장비 결산', hint: '구매·강화·판매 시트' },
      // 확인하고 싶을 때만 보는 화면이라 맨 뒤에 둔다
      { to: '/ledger', label: '메소 내역', hint: '보유 메소와 들고 남', exact: true },
    ],
  },
  {
    key: 'enhance',
    label: '강화',
    isNew: true,
    items: [
      { to: '/starforce', label: '스타포스', hint: '구간별 시도·파괴·메소' },
      { to: '/potential', label: '잠재능력', hint: '윗잠·에디 등급 흐름' },
      { to: '/review', label: '결산', hint: '그날 강화 이득·손해와 운' },
    ],
  },
  {
    key: 'calc',
    label: '계산기',
    isNew: true,
    items: [
      { to: '/calc/starforce', label: '스타포스 기대값', hint: '목표 ★까지 드는 메소' },
      { to: '/calc/potential', label: '잠재 기대값', hint: '목표 등급·옵션까지' },
      { to: '/calc/liberation', label: '해방', hint: '보스 세팅으로 해방 날짜' },
    ],
  },
  // 매주 확인하러 오는 소식이라 묶음 없이 단독 메뉴로 둔다
  {
    key: 'sunday',
    label: '썬데이',
    items: [{ to: '/sunday', label: '썬데이 메이플', hint: '이번 주 이벤트' }],
  },
]

export function isNavItemActive(item: NavItem, path: string): boolean {
  return path === item.to || (!item.exact && item.to !== '/' && path.startsWith(`${item.to}/`))
}

// 지금 주소가 속한 메뉴 묶음. 로그인·내 정보처럼 묶음 밖 페이지면 null
export function navGroupOf(path: string): NavGroup | null {
  return NAV_GROUPS.find(group => group.items.some(item => isNavItemActive(item, path))) ?? null
}
