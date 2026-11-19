// 레다봇 슬래시 명령을 봇이 들어간 서버에 등록한다. 명령을 바꿀 때마다 다시 실행한다
// node --env-file=.env scripts/discord-commands.mjs

const { NUXT_DISCORD_APP_ID: appId, NUXT_DISCORD_BOT_TOKEN: token } = process.env
if (!appId || !token) throw new Error('.env에 NUXT_DISCORD_APP_ID, NUXT_DISCORD_BOT_TOKEN이 필요해요')

const MANAGE_CHANNELS = 1 << 4

const commands = [
  {
    name: '파티',
    description: '보스 파티',
    type: 1,
    contexts: [0],
    // 채널을 파티로 묶는 일이라 채널 관리 권한이 있는 사람만 보이게 한다
    default_member_permissions: String(MANAGE_CHANNELS),
    options: [{
      type: 1,
      name: '연결',
      description: '이 채널을 보스 파티로 연결해요',
      options: [{ type: 3, name: '이름', description: '파티 이름', required: true, max_length: 20 }],
    }],
  },
]

const api = async (path, init = {}) => {
  const res = await fetch(`https://discord.com/api/v10${path}`, { ...init, headers: { 'Authorization': `Bot ${token}`, 'Content-Type': 'application/json' } })
  const body = await res.json()
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(body)}`)
  return body
}

// 서버 명령은 등록 즉시 보인다
for (const guild of await api('/users/@me/guilds')) {
  const saved = await api(`/applications/${appId}/guilds/${guild.id}/commands`, { method: 'PUT', body: JSON.stringify(commands) })
  console.log(`${guild.name}: ${saved.map(c => `/${c.name}`).join(', ')}`)
}
