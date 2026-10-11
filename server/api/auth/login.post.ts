export default defineEventHandler(async (event) => {
  await rateLimit(event, 'login', 5, 60)

  const body = await readBody<{ apiKey?: unknown, remember?: unknown, agree?: unknown }>(event)
  if (body?.agree !== true) throw createError({ statusCode: 400, message: '키 보관과 자동 수집에 동의해야 이용할 수 있어요.' })
  const apiKey = readApiKey(body.apiKey)

  const { accountId, characters } = await fetchAccountCharacters(apiKey)
  if (!accountId) throw createError({ statusCode: 400, message: '이 키로 조회되는 메이플스토리 계정이 없어요.' })

  const { users, sessions } = await useCollections()
  const now = new Date()
  const user = await users.findOneAndUpdate(
    { nexonAccountId: accountId },
    {
      $set: {
        keyEnc: encryptApiKey(apiKey),
        keyVersion: KEY_VERSION,
        keyHash: hashApiKey(apiKey),
        keyLast4: apiKey.slice(-4),
        keyStatus: 'valid',
        keyStatusReason: null,
        keyCheckedAt: now,
        lastSeenAt: now,
      },
      $setOnInsert: { nexonAccountId: accountId, mainOcid: null, consentAt: now, createdAt: now },
    },
    { upsert: true, returnDocument: 'after' },
  )
  if (!user) throw createError({ statusCode: 500, message: '로그인에 실패했어요.' })

  // 로그인한 채로 다시 로그인하면 이전 세션이 쿠키만 잃고 남으므로 지운다
  if (event.context.session) await sessions.deleteOne({ _id: event.context.session._id })
  await createSession(event, user._id, body.remember !== false)
  return { needsMain: !user.mainOcid, characters }
})
