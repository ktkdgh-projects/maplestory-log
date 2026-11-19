import type { PartySplitRequest } from '#shared/types'
import { botRateLimit } from '../../utils/discord/db'
import { postPartySplit } from '../../utils/discord/split'
import { partyOfBotUser } from '../../utils/discord/webAuth'

// 파티 채널에 분배금 결과를 올린다
export default defineEventHandler(async (event) => {
  const body = await readBody<{ p?: unknown } & Partial<PartySplitRequest>>(event)
  const { party, userId } = await partyOfBotUser(event, body?.p)
  await botRateLimit('split-post', userId, 10, 60)
  await postPartySplit(party, userId, body)
  return { ok: true }
})
