import type { ObjectId } from 'mongodb'
import type { Memo } from '#shared/types'

export const MAX_MEMOS = 100
const TITLE_MAX = 60
const BODY_MAX = 20000

export function toMemo(doc: MemoDoc): Memo {
  return { id: doc._id.toHexString(), title: doc.title, body: doc.body, updatedAt: doc.updatedAt.toISOString() }
}

export const memoOwner = (userId: ObjectId) => sha256(`memo:${userId.toHexString()}`).slice(0, 16)

// 비워 둔 칸은 그대로 두고, 들어온 칸만 길이를 잘라 받는다
export function parseMemo(body: { title?: unknown, body?: unknown } | undefined): Partial<Pick<MemoDoc, 'title' | 'body'>> {
  const memo: Partial<Pick<MemoDoc, 'title' | 'body'>> = {}
  if (typeof body?.title === 'string') memo.title = body.title.trim().slice(0, TITLE_MAX)
  if (typeof body?.body === 'string') {
    if (body.body.length > BODY_MAX) throw createError({ statusCode: 400, message: `메모는 ${BODY_MAX.toLocaleString()}자까지 적을 수 있어요.` })
    memo.body = body.body
  }
  return memo
}
