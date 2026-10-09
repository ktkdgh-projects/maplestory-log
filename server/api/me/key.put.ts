export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  await rateLimit(event, 'login', 5, 60)
  const apiKey = readApiKey((await readBody<{ apiKey?: unknown }>(event))?.apiKey)

  const { accountId } = await fetchAccountCharacters(apiKey)
  if (accountId !== user.nexonAccountId) {
    throw createError({ statusCode: 403, message: '지금 계정과 같은 넥슨 계정에서 발급한 키만 등록할 수 있어요.' })
  }

  const { users } = await useCollections()
  await users.updateOne({ _id: user._id }, {
    $set: {
      keyEnc: encryptApiKey(apiKey),
      keyVersion: KEY_VERSION,
      keyHash: hashApiKey(apiKey),
      keyLast4: apiKey.slice(-4),
      keyStatus: 'valid',
      keyStatusReason: null,
      keyCheckedAt: new Date(),
    },
  })
  await revokeSessions(user._id, { exceptId: event.context.session?._id })
  return { ok: true }
})
