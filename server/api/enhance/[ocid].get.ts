import type { EnhanceResponse, EnhanceSummary } from '#shared/types'

const SYNC_BUDGET_MS = 6000
const EMPTY_SUMMARY: EnhanceSummary = { starforce: { attempts: 0, success: 0, destroy: 0 }, cubes: 0, resets: 0, meso: { starforce: 0, potential: 0 }, first: null, last: null }

export default defineEventHandler(async (event): Promise<EnhanceResponse> => {
  const user = requireUser(event)
  const ocid = getRouterParam(event, 'ocid')
  const { from: fromQuery } = getQuery(event)
  const from = fromQuery ? parseDate(fromQuery) : null
  const apiKey = await getUserApiKey(user._id)

  // 강화 기록은 계정 단위라 내 계정 캐릭터만 볼 수 있게 한다
  const { characters } = await fetchAccountCharacters(apiKey)
  const character = characters.find(c => c.ocid === ocid)
  if (!character) throw createError({ statusCode: 404, message: '내 계정의 캐릭터만 볼 수 있어요.' })

  if (user.keyStatus === 'valid' && !(await isCollectionPaused())) await syncEnhanceHistory(user._id, SYNC_BUDGET_MS)

  const detail = await getCharacterDetail(apiKey, character.ocid).catch((error) => {
    throw toHttpError(error)
  })
  const equipped = detail.presets[detail.presetNo - 1] ?? detail.presets[0] ?? []
  // 스타포스 기록엔 장비 레벨이 없어 지금 낀 같은 이름 장비의 착용 레벨로 비용을 추정한다
  const byItem = await eventsByItem(user._id, character.name, equipped.map(i => ({ name: i.name, level: i.requiredLevel || null })), from)

  const { historySync } = await useCollections()
  const sync = await historySync.findOne({ _id: user._id })
  return {
    character: { ...character, imageUrl: detail.imageUrl },
    items: equipped.map((item) => {
      const found = byItem.get(item.name)
      return {
        slot: item.slot,
        name: item.name,
        icon: item.icon,
        level: item.requiredLevel || null,
        starforce: item.starforce,
        potentialGrade: item.potentialGrade,
        additionalGrade: item.additionalGrade,
        summary: found?.summary ?? EMPTY_SUMMARY,
        events: found?.events ?? [],
      }
    }),
    syncedFrom: sync?.oldest ?? null,
    syncing: !sync?.done,
  }
})
