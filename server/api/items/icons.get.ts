import type { ItemIcon } from '#shared/types'

export default defineEventHandler(async (event): Promise<ItemIcon[]> => {
  requireUser(event)
  const q = getQuery(event).q
  return typeof q === 'string' && q.trim() ? searchIcons(q.trim().slice(0, 40)) : []
})
