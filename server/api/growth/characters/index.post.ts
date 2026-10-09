export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const { ocid } = await readBody<{ ocid?: unknown }>(event)
  if (typeof ocid !== 'string') throw createError({ statusCode: 400, message: '캐릭터를 골라 주세요.' })

  const tracked = await listTracked(user._id)
  if (tracked.some(t => t.ocid === ocid)) return { ok: true }
  if (tracked.length >= MAX_TRACKED_CHARACTERS) throw createError({ statusCode: 409, message: `성장 기록은 ${MAX_TRACKED_CHARACTERS}명까지 모을 수 있어요.` })

  const { characters } = await fetchAccountCharacters(await getUserApiKey(user._id))
  const character = characters.find(c => c.ocid === ocid)
  if (!character) throw createError({ statusCode: 403, message: '내 계정의 캐릭터만 추가할 수 있어요.' })

  await trackCharacter(user._id, character)
  return { ok: true }
})
