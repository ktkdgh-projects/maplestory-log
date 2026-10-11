import type { SundayResponse } from '#shared/types'

export default defineEventHandler((): Promise<SundayResponse> => sundayOverview())
