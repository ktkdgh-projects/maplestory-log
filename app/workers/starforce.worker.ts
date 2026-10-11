// 높은 성급은 계산이 수백 ms라 화면이 멈추지 않게 Worker로 돌린다
import { planStarforce, type StarforceOptions } from '#shared/calc/starforce'

self.onmessage = (event: MessageEvent<{ id: number, options: StarforceOptions }>) => {
  self.postMessage({ id: event.data.id, plan: planStarforce(event.data.options) })
}
