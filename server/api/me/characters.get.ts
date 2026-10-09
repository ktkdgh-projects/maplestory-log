export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const { characters } = await fetchAccountCharacters(await getUserApiKey(user._id))
  return characters
})
