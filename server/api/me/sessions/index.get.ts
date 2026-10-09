import type { SessionInfo } from '#shared/types'

export default defineEventHandler(async (event): Promise<SessionInfo[]> => {
  const user = requireUser(event)
  const { sessions } = await useCollections()
  const list = await sessions.find({ userId: user._id, expiresAt: { $gt: new Date() } }).sort({ lastUsedAt: -1 }).toArray()
  return list.map(s => ({
    id: s._id.toHexString(),
    device: s.device,
    remember: s.remember,
    createdAt: s.createdAt.toISOString(),
    lastUsedAt: s.lastUsedAt.toISOString(),
    current: s._id.equals(event.context.session!._id),
  }))
})
