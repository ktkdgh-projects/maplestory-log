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
  // 장비를 바꿔도 기간 합계가 줄지 않게, 지금 안 낀 장비의 기록도 같이 보여 준다. 다른 프리셋에 있으면 그 정보를 쓴다
  const presetItems = new Map(detail.presets.flat().map(i => [i.name, i]))
  const names = await characterNames(character)
  const unworn = await unwornRecordItems(user._id, names, new Set(equipped.map(i => i.name)), from)
  const missing = unworn.filter(u => !presetItems.has(u.name))
  let icons = await lookupItems(missing.map(u => u.name))
  const unknown = missing.filter(u => !icons.get(iconKey(u.name)) || !(u.level || icons.get(iconKey(u.name))?.level))
  if (unknown.length) {
    await collectHistoryIcons(await apiKey, character.ocid, unknown.map(u => ({ name: u.name, date: u.lastDate })))
    icons = await lookupItems(missing.map(u => u.name))
  }
  // 스타포스 기록엔 장비 레벨이 없어 같은 이름 장비의 착용 레벨로 비용을 추정한다
  const levelOf = (name: string, fallback: number | null) => presetItems.get(name)?.requiredLevel || fallback || icons.get(iconKey(name))?.level || null
  const summaries = await summariesByItem(user._id, names, [
    ...equipped.map(i => ({ name: i.name, level: i.requiredLevel || null })),
    ...unworn.map(u => ({ name: u.name, level: levelOf(u.name, u.level) })),
  ], from, user.mvpDiscount ?? 0)

  return {
    character: { ...character, imageUrl: detail.imageUrl },
    items: [...equipped.map(item => ({
      worn: true,
      slot: item.slot,
      name: item.name,
      icon: item.icon,
      level: item.requiredLevel || null,
      starforce: item.starforce,
      potentialGrade: item.potentialGrade,
      additionalGrade: item.additionalGrade,
      potentials: item.potentials,
      additionalPotentials: item.additionalPotentials,
      summary: summaries.get(item.name) ?? emptySummary(),
    })), ...unworn.map((u) => {
      const preset = presetItems.get(u.name)
      return {
        worn: false,
        slot: preset?.slot ?? icons.get(iconKey(u.name))?.part ?? '',
        name: u.name,
        icon: preset?.icon ?? icons.get(iconKey(u.name))?.icon ?? '',
        level: levelOf(u.name, u.level),
        starforce: preset?.starforce ?? u.star,
        potentialGrade: preset?.potentialGrade ?? null,
        additionalGrade: preset?.additionalGrade ?? null,
        potentials: preset?.potentials ?? [],
        additionalPotentials: preset?.additionalPotentials ?? [],
        summary: summaries.get(u.name) ?? emptySummary(),
      }
    })],
    syncedFrom: sync?.oldest ?? null,
    syncing: !sync?.done,
  }
})
