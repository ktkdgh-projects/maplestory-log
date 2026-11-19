const DISCORD_API = 'https://discord.com/api/v10'

async function discordApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { discordBotToken } = useRuntimeConfig()
  const res = await fetch(DISCORD_API + path, { ...init, headers: { 'Authorization': `Bot ${discordBotToken}`, 'Content-Type': 'application/json' } })
  if (!res.ok) throw new Error(`discord ${res.status} ${path}`)
  return (res.status === 204 ? undefined : await res.json()) as T
}

export const sendDiscordMessage = (channelId: string, body: object) => discordApi<{ id: string }>(`/channels/${channelId}/messages`, { method: 'POST', body: JSON.stringify(body) })
// 누른 사람에게만 보이던 답을 지운다. 할 일이 끝난 개인 메시지가 채널에 쌓이지 않게 하려는 것
export async function deleteDiscordReply(interaction: { application_id?: string, token?: string }) {
  // 먼저 보낸 응답이 디스코드에 닿은 뒤에야 지울 수 있다
  await new Promise(resolve => setTimeout(resolve, 400))
  await discordApi(`/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`, { method: 'DELETE' }).catch(error => console.error('[leda] 개인 메시지 지우기 실패', String(error?.message ?? error)))
}

export const editDiscordMessage = (channelId: string, messageId: string, body: object) => discordApi<{ id: string }>(`/channels/${channelId}/messages/${messageId}`, { method: 'PATCH', body: JSON.stringify(body) })

interface Overwrite { id: string, type: 0 | 1, allow: string, deny: string }
interface Role { id: string, permissions: string }
interface Member { user: { id: string, username: string, global_name: string | null, bot?: boolean }, nick: string | null, roles: string[] }

// 빌드 대상이 BigInt 리터럴(1n)을 경고해서 BigInt()로 쓴다
const NONE = BigInt(0)
const ADMINISTRATOR = BigInt(1) << BigInt(3)
const VIEW_CHANNEL = BigInt(1) << BigInt(10)
// 서버 인원이 이보다 많아지면 나눠 받아야 하지만, 파티용 서버라 한 번에 받는다
const MEMBER_LIMIT = 1000

// 디스코드 권한 계산 순서: 서버 역할 → @everyone 덮어쓰기 → 역할 덮어쓰기 → 사람 덮어쓰기
function canView(member: Member, guildId: string, ownerId: string, roles: Map<string, bigint>, overwrites: Overwrite[]) {
  if (member.user.id === ownerId) return true
  let perms = roles.get(guildId) ?? NONE
  for (const id of member.roles) perms |= roles.get(id) ?? NONE
  if (perms & ADMINISTRATOR) return true

  const apply = (list: Overwrite[]) => {
    const deny = list.reduce((n, o) => n | BigInt(o.deny), NONE)
    const allow = list.reduce((n, o) => n | BigInt(o.allow), NONE)
    perms = (perms & ~deny) | allow
  }
  apply(overwrites.filter(o => o.id === guildId))
  apply(overwrites.filter(o => o.type === 0 && o.id !== guildId && member.roles.includes(o.id)))
  apply(overwrites.filter(o => o.type === 1 && o.id === member.user.id))
  return (perms & VIEW_CHANNEL) !== NONE
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
