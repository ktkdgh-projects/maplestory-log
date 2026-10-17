export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  await limitUserNexon(event)
  return accountCharacters(user._id, () => getUserApiKey(user._id))
})
