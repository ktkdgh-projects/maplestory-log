import { expireSplits } from '../../utils/discord/split'
import { tickParties } from '../../utils/discord/week'

// 밖의 정기 호출(cron-job.org)이 몇 분마다 불러서, 시각이 된 알림·투표·공지를 돌리고 하루 지난 분배금 결과를 지운다
export default defineEventHandler(async (event) => {
  const { discordTickSecret } = useRuntimeConfig()
  if (!discordTickSecret || !sameSecret(getHeader(event, 'authorization') ?? '', `Bearer ${discordTickSecret}`)) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
  return { ran: await tickParties(), expiredSplits: await expireSplits() }
})
