import type { ItemIcon } from '#shared/types'

// 장비 추가 칸 자동완성: 넥슨 API에서 본 장비·펫·캐시템 이름을 아이콘과 함께 찾는다
export default defineEventHandler(async (event): Promise<ItemIcon[]> => {
  requireUser(event)
  const q = getQuery(event).q
  return typeof q === 'string' && q.trim() ? searchIcons(q.trim().slice(0, 40)) : []
})
