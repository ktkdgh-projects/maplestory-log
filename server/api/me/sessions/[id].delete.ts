import { ObjectId } from 'mongodb'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const id = getRouterParam(event, 'id')
  if (!id || !ObjectId.isValid(id)) throw createError({ statusCode: 404, message: '기기를 찾을 수 없어요.' })

  const { sessions } = await useCollections()
  const sessionId = new ObjectId(id)
  // 다른 사용자의 세션이면 userId 조건에 걸려 지워지지 않고 404가 된다
  const { deletedCount } = await sessions.deleteOne({ _id: sessionId, userId: user._id })
  if (!deletedCount) throw createError({ statusCode: 404, message: '기기를 찾을 수 없어요.' })

  if (sessionId.equals(event.context.session!._id)) clearSessionCookie(event)
  return { ok: true }
})
