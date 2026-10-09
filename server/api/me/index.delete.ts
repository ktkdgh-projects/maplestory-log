export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  assertSameKey(user, (await readBody<{ apiKey?: unknown }>(event))?.apiKey)

  // 스냅샷은 ocid 기준 공개 데이터라 남기고, 이 사용자에게 묶인 것만 지운다
  const { users, sessions, userCharacters, jobs, hunts, bossRosters, bossClears, itemSheets, itemRows, itemLogs, ledgerSettings, enhanceEvents, historySync } = await useCollections()
  await Promise.all([
    itemSheets.deleteMany({ userId: user._id }),
    itemRows.deleteMany({ userId: user._id }),
    itemLogs.deleteMany({ userId: user._id }),
    ledgerSettings.deleteOne({ _id: user._id }),
    enhanceEvents.deleteMany({ userId: user._id }),
    historySync.deleteOne({ _id: user._id }),
  ])
  await hunts.deleteMany({ userId: user._id })
  await bossRosters.deleteMany({ userId: user._id })
  await bossClears.deleteMany({ userId: user._id })
  await jobs.deleteMany({ userId: user._id })
  await userCharacters.deleteMany({ userId: user._id })
  await sessions.deleteMany({ userId: user._id })
  await users.deleteOne({ _id: user._id })
  clearSessionCookie(event)
  return { ok: true }
})
