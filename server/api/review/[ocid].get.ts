import type { EquipmentItem, ReviewResponse } from '#shared/types'

const SYNC_BUDGET_MS = 4000

// 기대값 비교는 브라우저 계산기가 한다
export default defineEventHandler(async (event): Promise<ReviewResponse> => {
  const user = requireUser(event)
  const today = kstToday()
  const range = parseReviewRange(getQuery(event), today)

  const apiKey = getUserApiKey(user._id)
  apiKey.catch(() => {})
  const [character, paused] = await Promise.all([ownCharacter(user._id, getRouterParam(event, 'ocid'), () => apiKey), isCollectionPaused()])
  // 어제·오늘이 들어 있는 기간만 새 기록을 먼저 모은다. 지난날은 이미 모여 있어 날짜를 바꿀 때마다 기다리지 않게
  if (range.to >= kstYesterday() && user.keyStatus === 'valid' && !paused) await syncEnhanceHistory(user._id, SYNC_BUDGET_MS)
  const names = await characterNames(character)
  // 스타포스 비용은 지금 낀 장비의 착용 레벨로 계산한다. 기록이 없으면 넥슨을 안 부르고, 실패해도 기록은 레벨 없이 보여 준다
  let equipped: EquipmentItem[] = []
  let equipmentMissing = false
  if (await hasRecords(user._id, names, range)) {
    const detail = await getCharacterDetail(await apiKey, character.ocid).catch((error) => {
      console.warn('[review] 장비 정보 받기 실패', redactApiKeys(String(error)))
      return null
    })
    equipped = detail ? detail.presets[detail.presetNo - 1] ?? detail.presets[0] ?? [] : []
    equipmentMissing = !detail
  }
  const [starforce, potential, days] = await Promise.all([
    reviewStarforce(user._id, names, range, equipped, user.mvpDiscount ?? 0),
    reviewPotential(user._id, names, range, equipped),
    recordDays(user._id, names, today),
  ])
  return { character, ...range, starforce, potential, recordDays: days, equipmentMissing }
})
