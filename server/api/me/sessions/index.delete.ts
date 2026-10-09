export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  await revokeSessions(user._id)
  clearSessionCookie(event)
  return { ok: true }
})
