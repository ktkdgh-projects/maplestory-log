import { ObjectId } from 'mongodb'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const { feeRate } = await loadLedgerSettings(user._id)
  const input = parseDropSale(await readBody(event), feeRate)

  const { dropSales } = await useCollections()
  await assertLedgerRoom(dropSales, user._id)
  const _id = new ObjectId()
  await dropSales.insertOne({ ...input, _id, userId: user._id, createdAt: new Date() })
  if (input.fee !== feeRate) await rememberFeeRate(user._id, input.fee)
  return { id: _id.toHexString() }
})
