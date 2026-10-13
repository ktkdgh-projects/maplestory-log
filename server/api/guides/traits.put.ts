import { JOB_TRAITS, type JobTraits } from '#shared/data/jobTraits'

const LEVELS = ['high', 'mid', 'low', 'unknown']
const FLAGS = ['yes', 'no', 'unknown']
const FIELDS: Record<keyof JobTraits, string[]> = {
  critOver: FLAGS,
  cooldown: LEVELS,
  buff: LEVELS,
  summon: FLAGS,
  finalAttack: FLAGS,
  stat: ['normal', 'xenon', 'demonAvenger'],
}

// 표 값과 다르게 고친 칸만 남긴다. traits가 null이면 표 값으로 되돌린다
export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const body = await readBody<{ job?: unknown, traits?: Record<string, unknown> | null }>(event)
  const job = typeof body?.job === 'string' ? body.job.trim() : ''
  if (!job || job.length > 30) throw createError({ statusCode: 400, message: '직업을 확인해 주세요.' })
  // 표에 있는 직업만 받아야 아무 이름이나 키로 쌓이지 않는다
  const base = JOB_TRAITS.find(r => r.job === job)
  if (!base) throw createError({ statusCode: 400, message: '직업을 확인해 주세요.' })
  const traits: Partial<JobTraits> = {}
  for (const [field, allowed] of Object.entries(FIELDS) as [keyof JobTraits, string[]][]) {
    const value = body?.traits?.[field]
    if (typeof value === 'string' && allowed.includes(value) && value !== base[field]) Object.assign(traits, { [field]: value })
  }
  const { guideSettings } = await useCollections()
  const empty = !Object.keys(traits).length
  await guideSettings.updateOne(
    { _id: user._id },
    empty ? { $unset: { [`jobTraits.${job}`]: '' }, $set: { updatedAt: new Date() } } : { $set: { [`jobTraits.${job}`]: traits, updatedAt: new Date() } },
    { upsert: true },
  )
  return { traits: empty ? null : traits }
})
