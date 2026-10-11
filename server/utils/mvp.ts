import type { UserDoc } from './mongo'

export interface MvpTimeline {
  at: (at: Date) => number
  // 등급을 바꾼 시각들과 각 구간의 할인율(rates.length === boundaries.length + 1). DB에서 구간별로 묶을 때 쓴다
  boundaries: Date[]
  rates: number[]
}

// 등급을 바꾸면 그 뒤 기록부터 새 할인을 쓰고 이전 기록은 그때 할인 그대로 둔다. 이력이 생기기 전 값은 처음부터 쓴 것으로 본다
export function mvpTimeline(user: Pick<UserDoc, 'mvpDiscount' | 'mvpHistory'>): MvpTimeline {
  const history = user.mvpHistory?.length ? [...user.mvpHistory].sort((a, b) => a.from.getTime() - b.from.getTime()) : [{ from: new Date(0), rate: user.mvpDiscount ?? 0 }]
  const boundaries = history.slice(1).map(h => h.from)
  const rates = history.map(h => h.rate)
  return {
    at: at => rates[boundaries.filter(b => b <= at).length]!,
    boundaries,
    rates,
  }
}

// 몇 번째 구간인지 DB 안에서 센다. rates[이 값]이 그 기록의 할인율이다
export const mvpPeriodExpr = (boundaries: Date[]) => ({ $size: { $filter: { input: boundaries, cond: { $lte: ['$$this', '$at'] } } } })
