import { seededRandom } from './seededRandom'
import { BASE_RESTORE_STAR, DISCOUNT_MAX_STAR, EVENT_DISCOUNT, LESS_DESTROY, PC_DISCOUNT, PROTECT_EXTRA, PROTECT_STARS, RESTORE_EVENT_DISCOUNT, SURE_STARS, baseCost, restoreCopies, restoreFee, starRates, traceStar } from '#shared/data/starforce'

export interface StarforceOptions {
  level: number
  from: number
  to: number
  // 파괴방지를 거는 성급(15·16·17 중)
  protect: number[]
  // 썬데이 효과
  discount: boolean
  sure: boolean
  lessDestroy: boolean
  restoreDiscount: boolean
  mvp: number
  pc: boolean
  // 같은 장비(노작) 1개 가격. 파괴되면 흔적 복구에 1~4개, 12성 복구에 1개가 든다
  copyPrice: number
}

export interface StageInfo {
  star: number
  success: number
  destroy: number
  cost: number
}

// 한 번 누를 때의 확률과 비용. 할인은 MVP·PC방을 더한 뒤 썬데이 30%를 곱하고, 파괴방지 추가 비용은 할인 없이 붙인다
export function stageInfo(o: StarforceOptions, star: number): StageInfo {
  let { success, destroy } = starRates(star)
  if (o.sure && SURE_STARS.includes(star)) {
    success = 1
    destroy = 0
  }
  if (o.lessDestroy && star <= LESS_DESTROY.maxStar) destroy *= 1 - LESS_DESTROY.rate
  const protect = PROTECT_STARS.includes(star) && o.protect.includes(star)
  if (protect) destroy = 0
  const base = baseCost(o.level, star)
  const memberRate = star <= DISCOUNT_MAX_STAR ? o.mvp + (o.pc ? PC_DISCOUNT : 0) : 0
  const cost = Math.round(base * (1 - memberRate) * (o.discount ? 1 - EVENT_DISCOUNT : 1)) + (protect ? base * PROTECT_EXTRA : 0)
  return { star, success, destroy, cost }
}

// 파괴된 성급에서 고르는 길. restore: 흔적 성급으로 복구(노작 n개 + 복구 메소), twelve: 노작 1개로 12성 복구
export type RestoreChoice = 'restore' | 'twelve'

export interface RestoreOption {
  // 파괴되기 전 성급(이 성급에서 누르다 터진 경우)
  star: number
  trace: number
  choice: RestoreChoice
  restoreCost: number
  twelveCost: number
  // 그 길로 갔을 때 목표까지 남는 기대 메소의 차이(고른 길이 이만큼 싸다)
  saving: number
}

export interface StarforcePlan {
  stages: StageInfo[]
  restores: RestoreOption[]
  mean: { meso: number, tries: number, destroys: number, copies: number }
  p50: number
  p90: number
  noDestroy: number
  // 메소 분포 막대(구간별 비율)와 그 구간의 끝 값
  histogram: { bins: number[], max: number }
  // 분포를 그린 모의 실험 횟수. 높은 성급은 한 번에 수천 번씩 눌러서 정해 둔 양까지만 돌린다
  runs: number
}

const MAX_RUNS = 10_000
const MIN_RUNS = 100
// 모의 실험에서 누르는 횟수 합의 상한. 27성 이상은 한 판에 수십만 번이라 이걸 넘으면 거기서 멈춘다(최소 판 수도 이 두 배 안에서만)
const MAX_TRIES = 3_000_000
const HARD_TRIES = MAX_TRIES * 2
const BINS = 24

interface Model {
  lo: number
  to: number
  stage: (star: number) => StageInfo
  // 파괴됐을 때 두 길의 즉시 비용과 도착 성급
  paths: (star: number) => { restore: { cost: number, copies: number, at: number }, twelve: { cost: number, copies: number, at: number } }
}

// 고정한 선택(policy)으로 목표까지의 기댓값을 연립방정식으로 바로 푼다. perTry: 한 번 누를 때, onDestroy: 파괴 뒤 그 길에서 더해지는 양
// 성급 s에서: (성공+파괴)·v(s) = perTry + 성공·v(s+1) + 파괴·(onDestroy + v(도착 성급)). 실패는 같은 자리라 양쪽에서 빠진다
function solve(m: Model, perTry: (s: StageInfo) => number, onDestroy: (path: { cost: number, copies: number }) => number, policy: (star: number) => RestoreChoice): Map<number, number> {
  const n = m.to - m.lo
  const a = Array.from({ length: n }, () => new Float64Array(n + 1))
  for (let s = m.lo; s < m.to; s++) {
    const row = a[s - m.lo]!
    const st = m.stage(s)
    row[s - m.lo]! += st.success + st.destroy
    if (s + 1 < m.to) row[s + 1 - m.lo]! -= st.success
    row[n] = perTry(st)
    if (st.destroy) {
      const path = m.paths(s)[policy(s)]
      if (path.at < m.to) row[path.at - m.lo]! -= st.destroy
      row[n]! += st.destroy * onDestroy(path)
    }
  }
  // 가우스 소거(부분 피벗). 성급은 많아야 31개라 바로 끝난다
  for (let c = 0; c < n; c++) {
    let pivot = c
    for (let r = c + 1; r < n; r++) if (Math.abs(a[r]![c]!) > Math.abs(a[pivot]![c]!)) pivot = r
    ;[a[c], a[pivot]] = [a[pivot]!, a[c]!]
    const pr = a[c]!
    for (let r = 0; r < n; r++) {
      if (r === c || !a[r]![c]) continue
      const f = a[r]![c]! / pr[c]!
      const row = a[r]!
      for (let k = c; k <= n; k++) row[k]! -= f * pr[k]!
    }
  }
  const v = new Map<number, number>([[m.to, 0]])
  for (let s = m.lo; s < m.to; s++) v.set(s, a[s - m.lo]![n]! / a[s - m.lo]![s - m.lo]!)
  return v
}

export function planStarforce(o: StarforceOptions): StarforcePlan {
  const cache = new Map<number, StageInfo>()
  const stage = (star: number) => cache.get(star) ?? cache.set(star, stageInfo(o, star)).get(star)!
  const fee = (trace: number) => restoreFee(o.level, trace) * (o.restoreDiscount ? 1 - RESTORE_EVENT_DISCOUNT : 1)
  const lo = Math.min(o.from, BASE_RESTORE_STAR)
  const model: Model = {
    lo,
    to: o.to,
    stage,
    paths: (star) => {
      const trace = traceStar(star)
      const copies = restoreCopies(trace)
      return {
        restore: { cost: copies * o.copyPrice + fee(trace), copies, at: trace },
        twelve: { cost: o.copyPrice, copies: 1, at: BASE_RESTORE_STAR },
      }
    },
  }

  // 1) 메소가 가장 적게 드는 선택을 찾는다(정책 반복: 풀고 → 더 싼 쪽으로 바꾸고 → 안 바뀔 때까지)
  const policy = new Map<number, RestoreChoice>()
  const fixed = (star: number) => policy.get(star) ?? 'restore'
  let best = solve(model, s => s.cost, p => p.cost, fixed)
  for (let round = 0; round < 50; round++) {
    let changed = false
    for (let s = lo; s < o.to; s++) {
      if (!stage(s).destroy) continue
      const p = model.paths(s)
      const pick: RestoreChoice = p.restore.cost + best.get(p.restore.at)! <= p.twelve.cost + best.get(p.twelve.at)! ? 'restore' : 'twelve'
      if (pick !== fixed(s)) changed = true
      policy.set(s, pick)
    }
    if (!changed) break
    best = solve(model, s => s.cost, p => p.cost, fixed)
  }
  const at = (q: (s: StageInfo) => number, d: (p: { cost: number, copies: number }) => number) => solve(model, q, d, fixed).get(o.from)!

  const stages: StageInfo[] = []
  for (let s = o.from; s < o.to; s++) stages.push(stage(s))
  const restores: RestoreOption[] = []
  for (let s = Math.max(o.from, lo); s < o.to; s++) {
    if (!stage(s).destroy) continue
    const p = model.paths(s)
    const restoreTotal = p.restore.cost + best.get(p.restore.at)!
    const twelveTotal = p.twelve.cost + best.get(p.twelve.at)!
    restores.push({ star: s, trace: p.restore.at, choice: fixed(s), restoreCost: p.restore.cost, twelveCost: p.twelve.cost, saving: Math.abs(restoreTotal - twelveTotal) })
  }

  const mean = {
    meso: best.get(o.from)!,
    tries: at(() => 1, () => 0),
    destroys: at(() => 0, () => 1),
    copies: at(() => 0, p => p.copies),
  }
  // 실패는 같은 자리라서, 한 번도 안 터지려면 성급마다 '터지기 전에 성공'해야 한다
  const noDestroy = stages.reduce((p, s) => p * (s.success / (s.success + s.destroy)), 1)

  const random = seededRandom()
  const runs: number[] = []
  let budget = MAX_TRIES
  while (runs.length < MAX_RUNS && (budget > 0 || (runs.length < MIN_RUNS && budget > MAX_TRIES - HARD_TRIES))) {
    let star = o.from
    let meso = 0
    // 한 판이 상한을 넘게 길어지면 그 판은 버린다
    while (star < o.to && budget > MAX_TRIES - HARD_TRIES) {
      const st = stage(star)
      meso += st.cost
      budget--
      const r = random()
      if (r < st.success) star++
      else if (r < st.success + st.destroy) {
        const path = model.paths(star)[fixed(star)]
        meso += path.cost
        star = path.at
      }
    }
    if (star >= o.to) runs.push(meso)
  }
  // 한 판도 못 끝낼 만큼 길면 평균만 보여준다
  if (!runs.length) runs.push(mean.meso)
  runs.sort((a, b) => a - b)
  const pick = (q: number) => runs[Math.min(runs.length - 1, Math.floor(runs.length * q))]!
  // 꼬리가 너무 길면 막대가 뭉개져서 99% 지점까지만 그린다
  const max = pick(0.99) || 1
  const bins = Array.from({ length: BINS }, () => 0)
  for (const m of runs) bins[Math.min(BINS - 1, Math.floor((m / max) * BINS))]!++
  return {
    stages,
    restores,
    mean,
    p50: pick(0.5),
    p90: pick(0.9),
    noDestroy,
    histogram: { bins: bins.map(n => n / runs.length), max },
    runs: runs.length,
  }
}
