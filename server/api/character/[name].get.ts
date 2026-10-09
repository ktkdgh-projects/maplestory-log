import type { CharacterDetail } from '#shared/types'

export default defineEventHandler(async (event): Promise<CharacterDetail> => {
  const name = getRouterParam(event, 'name')?.trim()
  if (!name || name.length > 20) throw createError({ statusCode: 400, message: '캐릭터 이름을 확인해 주세요.' })

  const apiKey = await searchApiKey(event, 'search')

  try {
    const detail = await getCharacterDetail(apiKey, await resolveOcid(apiKey, name))
    if (detail.name === name) return detail
    // 이름을 바꾼 캐릭터면 캐시된 ocid가 다른 캐릭터를 가리키므로 새로 찾는다
    return await getCharacterDetail(apiKey, (await nexon.ocid(apiKey, name)).ocid)
  }
  catch (error) {
    throw toHttpError(error)
  }
})
