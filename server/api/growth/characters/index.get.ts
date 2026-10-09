export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  return listTracked(user._id)
})
