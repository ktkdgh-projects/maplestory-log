import { ObjectId } from 'mongodb'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const { feeRate } = await loadLedgerSettings(user._id)
  const input = parseMesoEntry(await readBody(event), feeRate)

  const { mesoEntries } = await useCollections()
  const _id = new ObjectId()
  await mesoEntries.insertOne({ ...input, _id, userId: user._id, createdAt: new Date() })
  return { id: _id.toHexString() }
})
