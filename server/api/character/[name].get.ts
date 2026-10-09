import type { CharacterDetail } from '#shared/types'

// 최신화는 캐시를 건너뛰고 넥슨을 바로 부르므로 IP당 따로 더 좁게 막는다
const REFRESH_LIMIT = 6

export default defineEventHandler(async (event): Promise<CharacterDetail> => {
  const name = getRouterParam(event, 'name')?.trim()
  if (!name || name.length > 20) throw createError({ statusCode: 400, message: '캐릭터 이름을 확인해 주세요.' })
  const fresh = getQuery(event).fresh === '1'
  if (fresh) await rateLimit(event, 'character-refresh', REFRESH_LIMIT, 60)

  const apiKey = await searchApiKey(event, 'search')

  try {
    const detail = await getCharacterDetail(apiKey, await resolveOcid(apiKey, name), fresh)
    if (detail.name === name) return detail
    // 이름을 바꾼 캐릭터면 캐시된 ocid가 다른 캐릭터를 가리키므로 새로 찾는다
    return await getCharacterDetail(apiKey, (await nexon.ocid(apiKey, name)).ocid, fresh)
  }
  catch (error) {
    throw toHttpError(error)
  }
})
