import type { Memo } from '#shared/types'
import { ObjectId } from 'mongodb'

export default defineEventHandler(async (event): Promise<Memo> => {
  const user = requireUser(event)
  const input = parseMemo(await readBody(event).catch(() => undefined))
  const { memos } = await useCollections()
  const existing = await memos.find({ userId: user._id }, { projection: { order: 1, createdAt: 1 } }).toArray()
  if (existing.length >= MAX_MEMOS) throw createError({ statusCode: 409, message: `메모는 ${MAX_MEMOS}개까지 만들 수 있어요.` })

  const now = new Date()
  const doc: MemoDoc = { _id: new ObjectId(), userId: user._id, title: input.title ?? '', body: input.body ?? '', order: Math.min(0, ...existing.map(memoSortKey)) - 1, createdAt: now, updatedAt: now }
  await memos.insertOne(doc)
  return toMemo(doc)
})
