export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const { ocid } = await readBody<{ ocid?: unknown }>(event)
  if (typeof ocid !== 'string') throw createError({ statusCode: 400, message: '캐릭터를 골라 주세요.' })

  const { characters } = await fetchAccountCharacters(await getUserApiKey(user._id))
  const character = characters.find(c => c.ocid === ocid)
  if (!character) throw createError({ statusCode: 403, message: '내 계정의 캐릭터만 대표로 고를 수 있어요.' })

  const { users } = await useCollections()
  await trackCharacter(user._id, character, true)
  await users.updateOne({ _id: user._id }, { $set: { mainOcid: ocid } })
  return { ok: true }
})
