import type { H3Event } from 'h3'
import type { UserDoc } from './mongo'

export function isAdmin(user: UserDoc | null | undefined): boolean {
  if (!user) return false
  const ids = useRuntimeConfig().adminAccountIds.split(',').map(s => s.trim()).filter(Boolean)
  return ids.includes(user.nexonAccountId)
}

// 관리자가 아니면 페이지가 있는지조차 알 수 없게 404로 돌려준다
export function requireAdmin(event: H3Event): UserDoc {
  const user = event.context.user as UserDoc | undefined
  if (!isAdmin(user)) throw createError({ statusCode: 404, message: '페이지를 찾을 수 없어요.' })
  return user!
}

// 넥슨 점검 등으로 수집을 잠시 멈췄는지
export async function isCollectionPaused(): Promise<boolean> {
  const { appSettings } = await useCollections()
  return (await appSettings.findOne({ _id: 'collection' }))?.paused ?? false
}
