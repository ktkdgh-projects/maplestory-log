import { normalizeMeister, type MeisterProgress } from '#shared/calc/meister'

export default defineEventHandler(async (event): Promise<MeisterProgress> => {
  const user = requireUser(event)
  const meister = normalizeMeister(await readBody<Partial<MeisterProgress>>(event))
  const { guideSettings } = await useCollections()
  await guideSettings.updateOne({ _id: user._id }, { $set: { meister, updatedAt: new Date() } }, { upsert: true })
  return meister
})
