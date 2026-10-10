import { findBoss, bossPeriod } from '#shared/data/bosses'
import { LIBERATIONS, traceOf, type LiberationKind } from '#shared/data/liberation'

export interface TraceBoss {
  bossId: string
  difficulty: string
  party: number
  // 이번 주기(주간·월간)에 이미 잡았으면 그 흔적은 지금 모은 흔적에 들어 있다고 보고 이번 주기엔 더하지 않는다
  cleared: boolean
}

// 제네시스 패스. until(주 시작일 기준, 그 주까지 포함)이 없으면 끝까지 적용한다
export interface GenesisPass {
  on: boolean
  until: string | null
}

export interface LiberationPlan {
  weekly: number
  monthly: number
  left: number
  // 단계마다 끝나는 주(목요일 초기화 날짜). 3년 안에 안 끝나면 null
  steps: { boss: string, need: number, week: string | null }[]
  finish: string | null
}

const MAX_WEEKS = 156

// step: 지금 하는 단계(0부터), collected: 그 단계에서 모은 흔적
export function planLiberation(kind: LiberationKind, step: number, collected: number, bosses: TraceBoss[], today: string, pass: GenesisPass = { on: false, until: null }): LiberationPlan {
  const isMonthly = (b: TraceBoss) => findBoss(b.bossId)?.cycle === 'monthly'
  // 패스는 정해진 날까지만 3배다. 날짜는 주 시작일(목요일)로 비교한다
  const passOn = (week: string) => pass.on && (!pass.until || week <= bossPeriod('weekly', pass.until))
  const gain = (list: TraceBoss[], week: string) => list.reduce((n, b) => n + traceOf(kind, b.bossId, b.difficulty, b.party, passOn(week)), 0)

  const start = bossPeriod('weekly', today)
  const weekly = gain(bosses.filter(b => !isMonthly(b)), start)
  const monthly = gain(bosses.filter(isMonthly), start)

  const remaining = LIBERATIONS[kind].steps.slice(step)
  const left = Math.max(0, remaining.reduce((n, s) => n + s.need, 0) - collected)
  const steps: LiberationPlan['steps'] = remaining.map(s => ({ boss: s.boss, need: s.need, week: null }))

  let have = collected
  let index = 0
  const thisMonth = bossPeriod('monthly', today)
  const countedMonths = new Set<string>()
  for (let w = 0; w < MAX_WEEKS && index < steps.length; w++) {
    const week = addDays(start, w * 7)
    // 이번 주에 이미 잡은 보스는 빼고, 다음 주부터는 모두 더한다
    have += gain(bosses.filter(b => !isMonthly(b) && (w > 0 || !b.cleared)), week)
    // 월간 보스는 그 달에 처음 오는 주에 한 번 잡는다고 본다
    const month = bossPeriod('monthly', week)
    if (!countedMonths.has(month)) {
      countedMonths.add(month)
      have += gain(bosses.filter(b => isMonthly(b) && !(month === thisMonth && b.cleared)), week)
    }
    // 최대로 쌓을 수 있는 양을 넘으면 버려진다
    have = Math.min(have, LIBERATIONS[kind].cap)
    while (index < steps.length && have >= steps[index]!.need) {
      have -= steps[index]!.need
      steps[index]!.week = week
      index++
    }
  }
  return { weekly, monthly, left, steps, finish: steps.at(-1)?.week ?? null }
}
