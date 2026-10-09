import type { ObjectId } from 'mongodb'
import type { CharacterBrief, TrackedCharacter } from '#shared/types'

const INITIAL_BACKFILL_DAYS = 30

export async function trackCharacter(userId: ObjectId, character: CharacterBrief, isMain = false) {
  const { userCharacters } = await useCollections()
  await saveCharacter(character)
  if (isMain) await userCharacters.updateMany({ userId }, { $set: { isMain: false } })
  await userCharacters.updateOne(
    { userId, ocid: character.ocid },
    { $set: { isMain }, $setOnInsert: { trackedSince: new Date() } },
    { upsert: true },
  )
  await enqueueSnapshotJobs(userId, character.ocid, recentKstDates(INITIAL_BACKFILL_DAYS))
}

export async function listTracked(userId: ObjectId): Promise<TrackedCharacter[]> {
  const { userCharacters, characters } = await useCollections()
  const tracked = await userCharacters.find({ userId }).sort({ isMain: -1, trackedSince: 1 }).toArray()
  const docs = await characters.find({ ocid: { $in: tracked.map(t => t.ocid) } }).toArray()
  return tracked.flatMap((t) => {
    const c = docs.find(d => d.ocid === t.ocid)
    return c ? [{ ocid: c.ocid, name: c.name, world: c.world, job: c.job, level: c.level, imageUrl: c.imageUrl, isMain: t.isMain }] : []
  })
}

export async function isTracked(userId: ObjectId, ocid: string) {
  const { userCharacters } = await useCollections()
  return (await userCharacters.countDocuments({ userId, ocid })) > 0
}
