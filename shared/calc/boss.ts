import type { BossClear, BossLoot } from '#shared/types'
import { afterFee } from './meso'

// 수수료를 떼고 실제로 손에 들어온 메소. 팔지 않은 템(price 없음)은 0
export function lootNet(loot: BossLoot): number {
  return loot.price ? afterFee(loot.price, loot.fee) : 0
}

// 물욕템을 판 금액 합계. 결정석 메소(clear.meso)와 따로 보여 줄 때 쓴다
export function lootMeso(clear: Pick<BossClear, 'loot'>): number {
  return clear.loot.reduce((sum, l) => sum + lootNet(l), 0)
}

export function clearMeso(clear: Pick<BossClear, 'meso' | 'loot'>): number {
  return clear.meso + lootMeso(clear)
}
