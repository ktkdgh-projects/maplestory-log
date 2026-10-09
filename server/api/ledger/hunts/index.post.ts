import { ObjectId } from 'mongodb'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const input = parseHuntInput(await readBody(event))

  const { hunts } = await useCollections()
  const _id = new ObjectId()
  await hunts.insertOne({ ...input, _id, userId: user._id, createdAt: new Date() })
  return { id: _id.toHexString() }
})
