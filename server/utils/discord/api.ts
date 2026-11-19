const DISCORD_API = 'https://discord.com/api/v10'

export async function discordApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { discordBotToken } = useRuntimeConfig()
  const res = await fetch(DISCORD_API + path, { ...init, headers: { 'Authorization': `Bot ${discordBotToken}`, 'Content-Type': 'application/json' } })
  if (!res.ok) throw new Error(`discord ${res.status} ${path}`)
  return await res.json() as T
}

interface Overwrite { id: string, type: 0 | 1, allow: string, deny: string }
interface Role { id: string, permissions: string }
interface Member { user: { id: string, username: string, global_name: string | null, bot?: boolean }, nick: string | null, roles: string[] }

const ADMINISTRATOR = 1n << 3n
const VIEW_CHANNEL = 1n << 10n
// 서버 인원이 이보다 많아지면 나눠 받아야 하지만, 파티용 서버라 한 번에 받는다
const MEMBER_LIMIT = 1000

// 디스코드 권한 계산 순서: 서버 역할 → @everyone 덮어쓰기 → 역할 덮어쓰기 → 사람 덮어쓰기
function canView(member: Member, guildId: string, ownerId: string, roles: Map<string, bigint>, overwrites: Overwrite[]) {
  if (member.user.id === ownerId) return true
  let perms = roles.get(guildId) ?? 0n
  for (const id of member.roles) perms |= roles.get(id) ?? 0n
  if (perms & ADMINISTRATOR) return true

  const apply = (list: Overwrite[]) => {
    const deny = list.reduce((n, o) => n | BigInt(o.deny), 0n)
    const allow = list.reduce((n, o) => n | BigInt(o.allow), 0n)
    perms = (perms & ~deny) | allow
  }
  apply(overwrites.filter(o => o.id === guildId))
  apply(overwrites.filter(o => o.type === 0 && o.id !== guildId && member.roles.includes(o.id)))
  apply(overwrites.filter(o => o.type === 1 && o.id === member.user.id))
  return (perms & VIEW_CHANNEL) !== 0n
}

// 이 채널을 볼 수 있는 사람(봇 제외)과 서버에서 쓰는 이름
export async function channelViewers(guildId: string, channelId: string) {
  const [guild, channel, members] = await Promise.all([
    discordApi<{ owner_id: string, roles: Role[] }>(`/guilds/${guildId}`),
    discordApi<{ permission_overwrites?: Overwrite[] }>(`/channels/${channelId}`),
    discordApi<Member[]>(`/guilds/${guildId}/members?limit=${MEMBER_LIMIT}`),
  ])
  const roles = new Map(guild.roles.map(r => [r.id, BigInt(r.permissions)]))
  return members
    .filter(m => !m.user.bot && canView(m, guildId, guild.owner_id, roles, channel.permission_overwrites ?? []))
    .map(m => ({ userId: m.user.id, displayName: m.nick ?? m.user.global_name ?? m.user.username }))
}
