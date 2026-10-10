import type { MemosResponse } from '#shared/types'

export default defineEventHandler(async (event): Promise<MemosResponse> => {
  const user = requireUser(event)
  const { memos } = await useCollections()
  // 고칠 때마다 목록 순서가 바뀌지 않게 만든 순서(최신 위)로 둔다
  const docs = await memos.find({ userId: user._id }).sort({ createdAt: -1 }).limit(MAX_MEMOS).toArray()
  return { memos: docs.map(toMemo), owner: memoOwner(user._id) }
})
