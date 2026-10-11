import type { StarforceOptions, StarforcePlan } from '#shared/calc/starforce'

// cancel()한 계산의 Promise는 끝나지 않는다. 다음 계산은 새 Worker로 받는다
export function useStarforceWorker() {
  let worker: Worker | null = null
  let seq = 0
  const waiting = new Map<number, { resolve: (plan: StarforcePlan) => void, reject: (error: Error) => void }>()

  function failAll(error: Error) {
    for (const w of waiting.values()) w.reject(error)
    waiting.clear()
  }
  function ensure() {
    if (worker) return worker
    worker = new Worker(new URL('../workers/starforce.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<{ id: number, plan: StarforcePlan }>) => {
      waiting.get(event.data.id)?.resolve(event.data.plan)
      waiting.delete(event.data.id)
    }
    // Worker가 죽으면 기다리던 계산이 영영 안 끝나므로 실패로 돌려주고 다음 계산은 새 Worker로 한다
    const broken = () => {
      worker?.terminate()
      worker = null
      failAll(new Error('계산하지 못했어요. 페이지를 새로 고쳐 주세요.'))
    }
    worker.onerror = broken
    worker.onmessageerror = broken
    return worker
  }
  function plan(options: StarforceOptions): Promise<StarforcePlan> {
    // 서버 렌더링엔 Worker가 없어서 결과를 기다리기만 한다(브라우저에서 다시 계산한다)
    if (!import.meta.client) return new Promise(() => {})
    const id = ++seq
    return new Promise((resolve, reject) => {
      waiting.set(id, { resolve, reject })
      try {
        ensure().postMessage({ id, options: { ...options, protect: [...options.protect] } })
      }
      catch (error) {
        waiting.delete(id)
        reject(error instanceof Error ? error : new Error(String(error)))
      }
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
