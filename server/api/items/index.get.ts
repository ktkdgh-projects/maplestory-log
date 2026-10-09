import type { ItemsResponse } from '#shared/types'

export default defineEventHandler(async (event): Promise<ItemsResponse> => {
  const user = requireUser(event)
  const { itemSheets, itemRows } = await useCollections()
  const [sheets, rows] = await Promise.all([
    itemSheets.find({ userId: user._id }).sort({ order: 1, createdAt: 1 }).toArray(),
    itemRows.find({ userId: user._id }).sort({ order: 1 }).toArray(),
  ])
  const references = await rowReferences(user._id, sheets, rows)
  return { sheets: sheets.map(s => toItemSheet(s, rows, references)) }
})
