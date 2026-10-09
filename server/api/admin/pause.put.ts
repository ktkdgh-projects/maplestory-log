export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const { paused } = await readBody<{ paused?: unknown }>(event)
  if (typeof paused !== 'boolean') throw createError({ statusCode: 400, message: 'paused 값이 필요해요.' })

  const { appSettings } = await useCollections()
  const now = new Date()
  await appSettings.updateOne({ _id: 'collection' }, { $set: { paused, pausedAt: paused ? now : null, updatedAt: now } }, { upsert: true })
  return { ok: true }
})
