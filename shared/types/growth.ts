import type { CharacterBrief } from './character'

export interface SnapshotPoint {
  date: string
  level: number
  exp: number
  expRate: number
  combatPower: number | null
}

export interface TrackedCharacter extends CharacterBrief {
  imageUrl: string | null
  isMain: boolean
}

export interface SnapshotsResponse {
  character: (CharacterBrief & { imageUrl: string | null }) | null
  points: SnapshotPoint[]
  today: SnapshotPoint | null
  pending: number
}
