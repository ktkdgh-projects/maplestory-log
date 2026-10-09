import type { UnionResponse } from '#shared/types'
import type { NexonUnion } from '../../utils/nexon'

const IMAGE_FRESH_MS = 24 * 60 * 60 * 1000
const IMAGE_BUDGET_MS = 4000
const UNION_CACHE_MS = 10 * 60 * 1000

export default defineEventHandler(async (event): Promise<UnionResponse> => {
  const user = requireUser(event)
  const ocid = getRouterParam(event, 'ocid')
  const apiKey = await getUserApiKey(user._id)

  const { characters } = await fetchAccountCharacters(apiKey)
  const owner = characters.find(c => c.ocid === ocid)
  if (!owner) throw createError({ statusCode: 403, message: '내 계정의 캐릭터만 유니온 목록을 볼 수 있어요.' })

  // 유니온은 월드마다 따로라 월드별 최고 레벨 캐릭터로 확인한다. 닫힌 월드는 유니온 정보가 비어서 온다
  const worldNames = [...new Set(characters.map(c => c.world))]
  const unions = new Map(await withCache(`union:${user.nexonAccountId}`, UNION_CACHE_MS, async () => {
    const entries: [string, NexonUnion][] = []
    for (const name of worldNames) {
      const representative = characters.find(c => c.world === name)!
      entries.push([name, await nexon.union(apiKey, representative.ocid).catch((error) => {
        throw toHttpError(error)
      })])
    }
    return entries
  }))

  const requested = getQuery(event).world
  const world = typeof requested === 'string' && unions.has(requested) ? requested : owner.world
  const members = characters.filter(c => c.world === world)
  const union = unions.get(world)

  const { characters: saved } = await useCollections()
  const docs = await saved.find({ ocid: { $in: members.map(m => m.ocid) } }, { projection: { ocid: 1, imageUrl: 1, updatedAt: 1 } }).toArray()
  const images = new Map(docs
    .filter(d => d.imageUrl && !d.imageUrl.includes('?') && Date.now() - d.updatedAt.getTime() < IMAGE_FRESH_MS)
    .map(d => [d.ocid, d.imageUrl!]))

  // 이미지는 캐릭터마다 따로 불러야 해서 한 번에 다 하지 않고, 남은 건 다음 요청이 이어받는다
  const deadline = Date.now() + IMAGE_BUDGET_MS
  for (const member of members) {
    if (images.has(member.ocid) || Date.now() > deadline) continue
    try {
      const basic = await nexon.basic(apiKey, member.ocid)
      const imageUrl = characterImageUrl(basic.character_image)
      images.set(member.ocid, imageUrl)
      await saveCharacter({ ...member, imageUrl })
    }
    catch {
      break
    }
  }

  return {
    worlds: worldNames
      .map(name => ({ name, count: characters.filter(c => c.world === name).length, active: (unions.get(name)?.union_level ?? null) !== null }))
      .sort((a, b) => Number(b.active) - Number(a.active) || b.count - a.count),
    world,
    unionLevel: union?.union_level ?? null,
    unionGrade: union?.union_grade ?? null,
    members: members.map(m => ({ ...m, imageUrl: images.get(m.ocid) ?? null })),
    pending: members.filter(m => !images.has(m.ocid)).length,
  }
})
