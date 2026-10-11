import type { EnhanceResponse } from '#shared/types'

// 서버리스 시간 초과를 피하려는 요청당 예산. 기록 모으기와 지난 장비 아이콘 찾기가 나눠 쓴다
const REQUEST_BUDGET_MS = 8000
const SYNC_BUDGET_MS = 5000

export default defineEventHandler(async (event): Promise<EnhanceResponse> => {
  const deadline = Date.now() + REQUEST_BUDGET_MS
  const user = requireUser(event)
  const { from: fromQuery } = getQuery(event)
  const from = fromQuery ? parseDate(fromQuery) : null
  const apiKey = getUserApiKey(user._id)
  // 캐시가 다 맞으면 키를 안 쓰고 끝날 수 있어, 그때 실패가 처리 안 된 오류로 남지 않게 한다
  apiKey.catch(() => {})

  const [character, paused] = await Promise.all([ownCharacter(user._id, getRouterParam(event, 'ocid'), () => apiKey), isCollectionPaused()])
  if (user.keyStatus === 'valid' && !paused) await syncEnhanceHistory(user._id, Math.min(SYNC_BUDGET_MS, deadline - Date.now()))

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
  // 지난 장비 아이콘은 남은 시간 안에서만 찾는다. 못 찾은 건 다음에 열 때 이어서 찾는다
  if (unknown.length && Date.now() < deadline) {
    await collectHistoryIcons(await apiKey, character.ocid, unknown.map(u => ({ name: u.name, date: u.lastDate })), deadline)
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
      // 다른 프리셋의 같은 이름 장비는 기록을 남긴 장비와 다를 수 있어, ★·등급은 마지막 기록을 먼저 본다
      const preset = presetItems.get(u.name)
      const potentialGrade = u.potentialGrade ?? preset?.potentialGrade ?? null
      const additionalGrade = u.additionalGrade ?? preset?.additionalGrade ?? null
      return {
        worn: false,
        slot: preset?.slot ?? icons.get(iconKey(u.name))?.part ?? '',
        name: u.name,
        icon: preset?.icon ?? icons.get(iconKey(u.name))?.icon ?? '',
        level: levelOf(u.name, u.level),
        starforce: u.star ?? preset?.starforce ?? 0,
        potentialGrade,
        additionalGrade,
        potentials: preset?.potentialGrade === potentialGrade ? preset.potentials : [],
        additionalPotentials: preset?.additionalGrade === additionalGrade ? preset.additionalPotentials : [],
        summary: summaries.get(u.name) ?? emptySummary(),
      }
    })],
    syncedFrom: sync?.oldest ?? null,
    syncing: !sync?.done,
  }
})
