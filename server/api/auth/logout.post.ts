export default defineEventHandler(async (event) => {
  const session = event.context.session
  if (session) {
    const { sessions } = await useCollections()
    await sessions.deleteOne({ _id: session._id })
  }
  clearSessionCookie(event)
  return { ok: true }
})
