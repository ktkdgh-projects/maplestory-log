export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  assertSameKey(user, (await readBody<{ apiKey?: unknown }>(event))?.apiKey)

  // 사용자를 먼저 지워야 뒤에서 돌던 수집(강화 기록·스냅샷 작업)이 사용자가 없는 걸 보고 더 쓰지 않는다
  const { users, sessions, userCharacters, jobs, jobLogs, hunts, dropSales, bossRosters, bossClears, itemSheets, itemRows, itemLogs, ledgerSettings, enhanceEvents, historySync, memos, mesoEntries, cache } = await useCollections()
  await users.deleteOne({ _id: user._id })
  await sessions.deleteMany({ userId: user._id })
  // 스냅샷은 ocid 기준 공개 데이터라 남기고, 이 사용자에게 묶인 것만 지운다
  await Promise.all([
    userCharacters.deleteMany({ userId: user._id }),
    jobs.deleteMany({ userId: user._id }),
    jobLogs.deleteMany({ userId: user._id }),
    hunts.deleteMany({ userId: user._id }),
    dropSales.deleteMany({ userId: user._id }),
    mesoEntries.deleteMany({ userId: user._id }),
    bossRosters.deleteMany({ userId: user._id }),
    bossClears.deleteMany({ userId: user._id }),
    itemSheets.deleteMany({ userId: user._id }),
    itemRows.deleteMany({ userId: user._id }),
    itemLogs.deleteMany({ userId: user._id }),
    ledgerSettings.deleteOne({ _id: user._id }),
    enhanceEvents.deleteMany({ userId: user._id }),
    historySync.deleteOne({ _id: user._id }),
    memos.deleteMany({ userId: user._id }),
    cache.deleteMany({ _id: { $in: [`account:${user._id.toHexString()}`, `union:${user.nexonAccountId}`] } }),
  ])
  clearSessionCookie(event)
  return { ok: true }
})
