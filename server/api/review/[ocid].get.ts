import type { ReviewResponse } from '#shared/types'

const SYNC_BUDGET_MS = 4000

// 강화 결산: 고른 기간(기본 오늘)의 스타포스·잠재 기록을 장비별로 묶어 돌려준다. 기대값 비교는 브라우저 계산기가 한다
export default defineEventHandler(async (event): Promise<ReviewResponse> => {
  const user = requireUser(event)
  const query = getQuery(event)
  const today = kstToday()
  const from = query.from ? parseDate(query.from) : today
  const to = query.to ? parseDate(query.to) : from
  if (to < from) throw createError({ statusCode: 400, message: '기간을 다시 골라 주세요.' })

  const apiKey = getUserApiKey(user._id)
  apiKey.catch(() => {})
  const [character, paused] = await Promise.all([ownCharacter(user._id, getRouterParam(event, 'ocid'), () => apiKey), isCollectionPaused()])
  // 어제·오늘이 들어 있는 기간만 새 기록을 먼저 모은다. 지난날은 이미 모여 있어 날짜를 바꿀 때마다 기다리지 않게
  if (to >= kstYesterday() && user.keyStatus === 'valid' && !paused) await syncEnhanceHistory(user._id, SYNC_BUDGET_MS)
  // 스타포스 기록엔 장비 레벨이 없어 지금 낀 같은 이름 장비의 착용 레벨로 비용을 계산한다
  const detail = await getCharacterDetail(await apiKey, character.ocid).catch((error) => {
    throw toHttpError(error)
  })
  const equipped = detail.presets[detail.presetNo - 1] ?? detail.presets[0] ?? []
  const range = { from, to }
  const [starforce, potential, days] = await Promise.all([
    reviewStarforce(user._id, character.name, range, equipped, user.mvpDiscount ?? 0),
    reviewPotential(user._id, character.name, range, equipped),
    recordDays(user._id, character.name, today),
  ])
  return { character, from, to, starforce, potential, recordDays: days }
})
