import type { UnionResponse } from '#shared/types'
import type { H3Event } from 'h3'
import type { NexonUnion } from '../../utils/nexon'

const IMAGE_FRESH_MS = 24 * 60 * 60 * 1000
const IMAGE_BUDGET_MS = 4000
const UNION_CACHE_MS = 10 * 60 * 1000

// 남의 캐릭터(또는 로그인 전): 유니온 등급과 공격대에 배치된 캐릭터의 직업·레벨
async function raiderUnion(event: H3Event, ocid: string): Promise<UnionResponse> {
  const apiKey = await searchApiKey(event, 'search')
  const world = typeof getQuery(event).world === 'string' ? getQuery(event).world as string : ''
  const [union, raider] = await withCache(`union-raider:${ocid}`, UNION_CACHE_MS, () => Promise.all([
    nexon.union(apiKey, ocid),
    nexon.unionRaider(apiKey, ocid),
  ])).catch((error) => {
    throw toHttpError(error)
  })
  const raiders = (raider.union_block ?? [])
    .map(b => ({ job: b.block_class, level: Number(b.block_level) || 0, type: b.block_type }))
    .sort((a, b) => b.level - a.level)
  return { mode: 'raider', worlds: [], world, unionLevel: union.union_level, unionGrade: union.union_grade, members: [], raiders, pending: 0 }
}

export default defineEventHandler(async (event): Promise<UnionResponse> => {
  const ocid = getRouterParam(event, 'ocid')
  if (!ocid || !/^[0-9a-f]{32}$/.test(ocid)) throw createError({ statusCode: 400, message: '캐릭터를 확인해 주세요.' })
  const user = event.context.user
  if (!user) return raiderUnion(event, ocid)
  const apiKey = await getUserApiKey(user._id)

  const characters = await accountCharacters(user._id, async () => apiKey)
  const owner = characters.find(c => c.ocid === ocid)
  // 내 계정 캐릭터가 아니면 공격대 정보로 보여 준다
  if (!owner) return raiderUnion(event, ocid)

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
    mode: 'account',
    raiders: [],
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
