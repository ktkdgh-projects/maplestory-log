import { normalizeMeister, type MeisterProgress } from '#shared/calc/meister'

export default defineEventHandler(async (event): Promise<MeisterProgress> => {
  const user = requireUser(event)
  const { guideSettings } = await useCollections()
  const doc = await guideSettings.findOne({ _id: user._id }, { projection: { meister: 1 } })
  return normalizeMeister(doc?.meister)
})
