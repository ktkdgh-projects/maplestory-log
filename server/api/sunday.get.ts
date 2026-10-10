import type { SundayResponse } from '#shared/types'

// 이번 주 썬데이 메이플과 지난 썬데이. 로그인 없이 볼 수 있다
export default defineEventHandler((): Promise<SundayResponse> => sundayOverview())
