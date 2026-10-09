import type { MeResponse } from '#shared/types'

export default defineEventHandler(async (event): Promise<MeResponse> => {
  const user = event.context.user
  if (!user) return { user: null }

  const { characters } = await useCollections()
  const main = user.mainOcid ? await characters.findOne({ ocid: user.mainOcid }) : null

  return {
    user: {
      keyLast4: user.keyLast4,
      keyStatus: user.keyStatus,
      keyCheckedAt: user.keyCheckedAt?.toISOString() ?? null,
      consentAt: user.consentAt.toISOString(),
      createdAt: user.createdAt.toISOString(),
      main: main && { ocid: main.ocid, name: main.name, world: main.world, job: main.job, level: main.level, imageUrl: main.imageUrl },
      isAdmin: isAdmin(user),
    },
  }
})
