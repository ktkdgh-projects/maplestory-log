import type { MemosResponse } from '#shared/types'

export default defineEventHandler(async (event): Promise<MemosResponse> => {
  const user = requireUser(event)
  const { memos } = await useCollections()
  // 고칠 때마다 목록 순서가 바뀌지 않게, 끌어서 정한 순서(없으면 만든 순서)로 둔다
  const docs = (await memos.find({ userId: user._id }).limit(MAX_MEMOS).toArray()).sort((a, b) => memoSortKey(a) - memoSortKey(b))
  return { memos: docs.map(toMemo), owner: memoOwner(user._id) }
})
