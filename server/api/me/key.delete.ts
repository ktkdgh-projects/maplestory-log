export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  assertSameKey(user, (await readBody<{ apiKey?: unknown }>(event))?.apiKey)

  const { users, jobs } = await useCollections()
  await users.updateOne({ _id: user._id }, {
    $set: { keyEnc: null, keyHash: null, keyLast4: null, keyStatus: 'deleted', keyStatusReason: null, keyCheckedAt: new Date() },
  })
  await jobs.deleteMany({ userId: user._id, status: { $in: ['pending', 'failed'] } })
  // 키 없이는 아무 기능도 쓸 수 없으므로 모든 기기에서 로그아웃시킨다
  await revokeSessions(user._id)
  clearSessionCookie(event)
  return { ok: true }
})
