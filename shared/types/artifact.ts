import type { ArtifactEffectKey } from '#shared/data/artifact'
import type { JobTraits } from '#shared/data/jobTraits'
import type { CharacterBrief } from './character'

export interface ArtifactCrystal {
  name: string
  level: number
  options: string[]
  expire: string | null
  valid: boolean
}

export interface ArtifactResponse {
  character: CharacterBrief
  level: number
  exp: number
  point: number
  remainAp: number
  effects: { key: ArtifactEffectKey, name: string, level: number }[]
  crystals: ArtifactCrystal[]
  stats: { name: string, value: string }[]
  percents: { stat: Record<string, number>, attack: number, magic: number }
  // 사용자가 고친 직업 특성. 없으면 표 값을 쓴다
  traits: Partial<JobTraits> | null
}
