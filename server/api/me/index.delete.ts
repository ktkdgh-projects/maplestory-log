export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  assertSameKey(user, (await readBody<{ apiKey?: unknown }>(event))?.apiKey)

  // 스냅샷은 ocid 기준 공개 데이터라 남기고, 이 사용자에게 묶인 것만 지운다
  const { users, sessions, userCharacters, jobs } = await useCollections()
  await jobs.deleteMany({ userId: user._id })
  await userCharacters.deleteMany({ userId: user._id })
  await sessions.deleteMany({ userId: user._id })
  await users.deleteOne({ _id: user._id })
  clearSessionCookie(event)
  return { ok: true }
})
