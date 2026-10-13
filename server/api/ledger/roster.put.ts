export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  // 순서만 바꿔도 저장돼서 다른 넥슨 호출보다 넉넉히 둔다
  await rateLimit(event, 'roster', 60, 60)
  const body = await readBody<{ characters?: unknown }>(event)
  const characters = await parseRoster(user._id, body?.characters)

  const { bossRosters } = await useCollections()
  await bossRosters.updateOne({ userId: user._id }, { $set: { characters, updatedAt: new Date() } }, { upsert: true })
  return characters
})
