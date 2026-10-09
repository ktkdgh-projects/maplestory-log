import type { EnhanceResponse } from '#shared/types'

const SYNC_BUDGET_MS = 6000

export default defineEventHandler(async (event): Promise<EnhanceResponse> => {
  const user = requireUser(event)
  const { from: fromQuery } = getQuery(event)
  const from = fromQuery ? parseDate(fromQuery) : null
  const apiKey = getUserApiKey(user._id)
  // 캐시가 다 맞으면 키를 안 쓰고 끝날 수 있어, 그때 실패가 처리 안 된 오류로 남지 않게 한다
  apiKey.catch(() => {})

  const [character, paused] = await Promise.all([ownCharacter(user._id, getRouterParam(event, 'ocid'), () => apiKey), isCollectionPaused()])
  if (user.keyStatus === 'valid' && !paused) await syncEnhanceHistory(user._id, SYNC_BUDGET_MS)

  const { historySync } = await useCollections()
  const [detail, sync] = await Promise.all([
    getCharacterDetail(await apiKey, character.ocid).catch((error) => {
      throw toHttpError(error)
    }),
    historySync.findOne({ _id: user._id }),
  ])
  const equipped = detail.presets[detail.presetNo - 1] ?? detail.presets[0] ?? []
  // 스타포스 기록엔 장비 레벨이 없어 지금 낀 같은 이름 장비의 착용 레벨로 비용을 추정한다
  const summaries = await summariesByItem(user._id, character.name, equipped.map(i => ({ name: i.name, level: i.requiredLevel || null })), from)

  return {
    character: { ...character, imageUrl: detail.imageUrl },
    items: equipped.map(item => ({
      slot: item.slot,
      name: item.name,
      icon: item.icon,
      level: item.requiredLevel || null,
      starforce: item.starforce,
      potentialGrade: item.potentialGrade,
      additionalGrade: item.additionalGrade,
      summary: summaries.get(item.name) ?? emptySummary(),
    })),
    syncedFrom: sync?.oldest ?? null,
    syncing: !sync?.done,
  }
})
