// 스타포스 계산(정확 기대값 + 모의 실험)을 화면과 따로 돌린다. 높은 성급은 수백 ms가 걸려 버튼 반응이 멈추지 않게 한다
import { planStarforce, type StarforceOptions } from '../utils/starforceCalc'

self.onmessage = (event: MessageEvent<{ id: number, options: StarforceOptions }>) => {
  self.postMessage({ id: event.data.id, plan: planStarforce(event.data.options) })
}
