export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const body = await readBody<Record<string, unknown>>(event)
  const character = parseText(body?.character, '캐릭터')
  const item = parseText(body?.item, '장비 이름')
  if (body?.kind !== 'starforce' && body?.kind !== 'potential') throw createError({ statusCode: 400, message: '강화 종류를 확인해 주세요.' })
  const kind = body.kind
  const date = parseDate(body?.date)
  const amount = parseMeso(body?.amount, '금액')
  if (!amount) throw createError({ statusCode: 400, message: '넣을 금액이 없어요.' })

  const { itemSheets, itemRows } = await useCollections()
  const sheets = await itemSheets.find({ userId: user._id, characterName: character }, { projection: { _id: 1 } }).toArray()
  const rows = sheets.length ? await itemRows.find({ userId: user._id, sheetId: { $in: sheets.map(s => s._id) }, name: item }).toArray() : []
  if (!rows.length) throw createError({ statusCode: 404, message: `장비 결산에 ${character}의 이 장비 줄이 없어요. 장비 결산에서 줄을 먼저 만들어 주세요.` })
  if (rows.length > 1) throw createError({ statusCode: 409, message: '같은 이름 장비가 여러 줄이라 어느 줄에 넣을지 몰라요. 장비 결산에서 직접 넣어 주세요.' })

  const row = rows[0]!
  const field = kind === 'starforce' ? 'starforceEntries' : 'potentialEntries'
  const current = row[field] ?? (row[kind] && row[`${kind}Date`] ? [{ date: row[`${kind}Date`]!, amount: row[kind]! }] : [])
  const entries = [...current.filter(e => e.date !== date), { date, amount }].sort((a, b) => a.date.localeCompare(b.date))
  await itemRows.updateOne({ _id: row._id }, {
    $set: { [field]: entries, [kind]: entries.reduce((sum, e) => sum + e.amount, 0), [`${kind}Date`]: entries.at(-1)!.date },
  })
  return { ok: true }
})
