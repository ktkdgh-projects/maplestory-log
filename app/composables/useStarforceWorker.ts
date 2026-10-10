import type { StarforceOptions, StarforcePlan } from '~/utils/starforceCalc'

// 스타포스 계산(정확 기대값 + 모의 실험)을 화면과 따로 도는 Worker에 맡긴다. 높은 성급은 수백 ms가 걸려 버튼 반응이 멈추지 않게 한다.
// cancel()은 돌고 있는 계산을 버리고(기다리던 결과는 오지 않는다) 다음 계산을 새 Worker로 받는다
export function useStarforceWorker() {
  let worker: Worker | null = null
  let seq = 0
  const waiting = new Map<number, (plan: StarforcePlan) => void>()

  function ensure() {
    if (worker) return worker
    worker = new Worker(new URL('../workers/starforce.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<{ id: number, plan: StarforcePlan }>) => {
      waiting.get(event.data.id)?.(event.data.plan)
      waiting.delete(event.data.id)
    }
    return worker
  }
  function plan(options: StarforceOptions): Promise<StarforcePlan> {
    const id = ++seq
    return new Promise((resolve) => {
      waiting.set(id, resolve)
      ensure().postMessage({ id, options: { ...options, protect: [...options.protect] } })
    })
  }
  function cancel() {
    worker?.terminate()
    worker = null
    waiting.clear()
  }
  onBeforeUnmount(cancel)
  return { plan, cancel, busy: () => waiting.size > 0 }
}
