import type { BossBoardResponse } from '#shared/types'
import { bossPeriod } from '#shared/data/bosses'

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export default defineEventHandler(async (event): Promise<BossBoardResponse> => {
  const user = requireUser(event)
  const query = getQuery(event).week
  const week = bossPeriod('weekly', typeof query === 'string' && DATE_PATTERN.test(query) ? query : kstToday())
  // 주가 두 달에 걸치면 월간 보스(검은 마법사)는 두 달 것을 모두 보여준다
  const months = [bossPeriod('monthly', week), bossPeriod('monthly', addDays(week, 6))]

  const { bossRosters, bossClears } = await useCollections()
  const [roster, clears] = await Promise.all([
    bossRosters.findOne({ userId: user._id }),
    bossClears.find({ userId: user._id, period: { $in: [week, ...months] } }).toArray(),
  ])
  return { week, roster: roster?.characters ?? [], clears: clears.map(toBossClear) }
})
