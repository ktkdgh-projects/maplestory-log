import type { ArtifactResponse } from '#shared/types'
import { artifactEffectOf } from '#shared/data/artifact'
import { equippedPercents } from '#shared/calc/combatPower'

const ARTIFACT_CACHE_MS = 10 * 60 * 1000

export default defineEventHandler(async (event): Promise<ArtifactResponse> => {
  const user = requireUser(event)
  await limitUserNexon(event)
  const keyPromise = getUserApiKey(user._id)
  keyPromise.catch(() => {})
  const character = await ownCharacter(user._id, getRouterParam(event, 'ocid'), () => keyPromise)
  const apiKey = await keyPromise

  const [artifact, union, detail, guide] = await Promise.all([
    withCache(`artifact:${character.ocid}`, ARTIFACT_CACHE_MS, () => nexon.unionArtifact(apiKey, character.ocid)),
    withCache(`union-artifact:${character.ocid}`, ARTIFACT_CACHE_MS, () => nexon.union(apiKey, character.ocid)),
    getCharacterDetail(apiKey, character.ocid),
    useCollections().then(({ guideSettings }) => guideSettings.findOne({ _id: user._id }, { projection: { jobTraits: 1 } })),
  ]).catch((error) => {
    throw toHttpError(error)
  })

  return {
    character,
    level: union.union_artifact_level ?? 0,
    exp: union.union_artifact_exp ?? 0,
    point: union.union_artifact_point ?? 0,
    remainAp: artifact.union_artifact_remain_ap ?? 0,
    effects: (artifact.union_artifact_effect ?? []).flatMap((e) => {
      const effect = artifactEffectOf(e.name)
      return effect ? [{ key: effect.key, name: e.name, level: e.level }] : []
    }),
    crystals: (artifact.union_artifact_crystal ?? []).map(c => ({
      name: c.name.replace(/^크리스탈\s*:\s*/, ''),
      level: c.level,
      options: [c.crystal_option_name_1, c.crystal_option_name_2, c.crystal_option_name_3].filter(Boolean),
      expire: c.date_expire,
      valid: c.validity_flag === '0',
    })),
    stats: detail.stats,
    percents: equippedPercents(detail),
    traits: guide?.jobTraits?.[character.job] ?? null,
  }
})
