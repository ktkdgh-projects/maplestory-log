import type { PartySplitRequest } from '#shared/types'
import { readPartyLink } from '../../utils/discord/link'
import { botRateLimit } from '../../utils/discord/db'
import { postPartySplit } from '../../utils/discord/split'
import { partyOfLink } from '../../utils/discord/time'

// 파티 채널에 분배금 결과를 올린다
export default defineEventHandler(async (event) => {
  const body = await readBody<{ t?: unknown } & Partial<PartySplitRequest>>(event)
  const link = readPartyLink(body?.t)
  await botRateLimit('split-post', link.userId, 10, 60)
  await postPartySplit(await partyOfLink(link), link.userId, body)
  return { ok: true }
})
