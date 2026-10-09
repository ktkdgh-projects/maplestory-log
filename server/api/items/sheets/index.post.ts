import { ObjectId } from 'mongodb'

const MAX_SHEETS = 20

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const body = await readBody<{ title?: unknown, ocid?: unknown }>(event)

  const { itemSheets } = await useCollections()
  const count = await itemSheets.countDocuments({ userId: user._id })
  if (count >= MAX_SHEETS) throw createError({ statusCode: 409, message: `시트는 ${MAX_SHEETS}개까지 만들 수 있어요.` })

  // 캐릭터를 연결하면 그 캐릭터 이름으로 강화 기록을 찾고 현재 장비를 불러올 수 있다
  let character: { ocid: string, name: string } | null = null
  if (typeof body?.ocid === 'string' && body.ocid) {
    const { characters } = await fetchAccountCharacters(await getUserApiKey(user._id))
    character = characters.find(c => c.ocid === body.ocid) ?? null
    if (!character) throw createError({ statusCode: 400, message: '내 계정의 캐릭터만 연결할 수 있어요.' })
  }

  const _id = new ObjectId()
  await itemSheets.insertOne({
    _id,
    userId: user._id,
    title: parseText(body?.title, '시트 이름', !character) || character!.name,
    ocid: character?.ocid ?? null,
    characterName: character?.name ?? null,
    excluded: false,
    order: count,
    createdAt: new Date(),
  })
  return { id: _id.toHexString() }
})
