import type { CharacterBrief } from '#shared/types'

export const matchCharacter = (c: CharacterBrief, keyword: string) => c.name.includes(keyword) || c.job.includes(keyword) || c.world.includes(keyword)
