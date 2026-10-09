export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const body = await readBody<{ characters?: unknown }>(event)
  const characters = await parseRoster(user._id, body?.characters)

  const { bossRosters } = await useCollections()
  await bossRosters.updateOne({ userId: user._id }, { $set: { characters, updatedAt: new Date() } }, { upsert: true })
  return characters
})
