export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const ocids = (await readBody<{ ocids?: unknown }>(event))?.ocids
  if (!Array.isArray(ocids) || ocids.length > MAX_TRACKED_CHARACTERS || ocids.some(o => typeof o !== 'string')) {
    throw createError({ statusCode: 400, message: '순서 정보가 올바르지 않아요.' })
  }

  if (!ocids.length) return { ok: true }
  const { userCharacters } = await useCollections()
  await userCharacters.bulkWrite(
    (ocids as string[]).map((ocid, order) => ({ updateOne: { filter: { userId: user._id, ocid }, update: { $set: { order } } } })),
    { ordered: false },
  )
  return { ok: true }
})
