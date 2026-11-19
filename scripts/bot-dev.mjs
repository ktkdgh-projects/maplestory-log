// 테스트 봇으로 로컬에서 레다봇을 돌린다: 로컬 서버 + 터널을 켜고, 테스트 봇의 엔드포인트와 명령을 그 주소로 맞춘다
// npm run dev:bot   (.env.bot-test에 테스트 봇 값이 있어야 한다)
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'

const PORT = 3001
const CLOUDFLARED = process.env.CLOUDFLARED_PATH ?? 'C:/Program Files (x86)/cloudflared/cloudflared.exe'
const { NUXT_DISCORD_BOT_TOKEN: token, NUXT_DISCORD_DB_NAME: dbName } = process.env

// 운영 봇의 엔드포인트를 터널로 바꿔 버리지 않게, 테스트용 DB 이름이 잡혀 있을 때만 돈다
if (!token || !dbName || dbName === 'leda') {
  console.error('.env.bot-test에 테스트 봇 값과 NUXT_DISCORD_DB_NAME=leda_test가 있어야 해요.')
  process.exit(1)
}

// 정해진 시각 알림은 운영에서는 밖의 정기 호출이 깨우고, 여기서는 15초마다 직접 깨운다
const TICK_MS = 15_000
process.env.NUXT_DISCORD_TICK_SECRET = randomBytes(24).toString('hex')
// 디스코드 로그인 뒤 돌아올 주소는 포털에 등록한 것과 같아야 해서, 켤 때마다 바뀌는 터널 대신 localhost를 쓴다
process.env.NUXT_DISCORD_SITE_URL ??= `http://localhost:${PORT}`

const children = []
const run = (cmd, args, opts = {}) => {
  const child = spawn(cmd, args, { env: process.env, ...opts })
  children.push(child)
  return child
}
const stop = () => {
  for (const child of children) child.kill()
  process.exit(0)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)

const discord = async (path, init = {}) => {
  const res = await fetch(`https://discord.com/api/v10${path}`, { ...init, headers: { 'Authorization': `Bot ${token}`, 'Content-Type': 'application/json' } })
  const body = await res.json()
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(body)}`)
  return body
}
const waitFor = async (url, okStatus, label) => {
  for (let i = 0; i < 90; i++) {
    const status = await fetch(url, { method: 'POST' }).then(r => r.status, () => 0)
    if (status === okStatus) return
    await new Promise(r => setTimeout(r, 2000))
  }
  throw new Error(`${label}이(가) 응답하지 않아요`)
}

run(process.execPath, ['node_modules/nuxt/bin/nuxt.mjs', 'dev', '--port', String(PORT)], { stdio: 'inherit' })

// 터널 주소는 cloudflared가 켜질 때 로그로 알려 준다
const tunnel = run(CLOUDFLARED, ['tunnel', '--url', `http://localhost:${PORT}`], { stdio: ['ignore', 'ignore', 'pipe'] })
const origin = await new Promise((resolve, reject) => {
  let log = ''
  tunnel.stderr.on('data', (chunk) => {
    log += chunk
    const found = log.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)
    if (found) resolve(found[0])
  })
  tunnel.on('exit', () => reject(new Error('터널을 켜지 못했어요')))
})

// 서명 없는 요청에 401이 오면 서버와 터널이 모두 준비된 것
await waitFor(`http://localhost:${PORT}/api/discord/interactions`, 401, '로컬 서버')
await waitFor(`${origin}/api/discord/interactions`, 401, '터널')

const app = await discord('/applications/@me', { method: 'PATCH', body: JSON.stringify({ interactions_endpoint_url: `${origin}/api/discord/interactions` }) })
await new Promise((resolve, reject) => run(process.execPath, ['scripts/discord-commands.mjs'], { stdio: 'inherit' }).on('exit', code => (code ? reject(new Error('명령 등록 실패')) : resolve())))

setInterval(() => {
  fetch(`http://localhost:${PORT}/api/discord/tick`, { headers: { Authorization: `Bearer ${process.env.NUXT_DISCORD_TICK_SECRET}` } }).catch(() => {})
}, TICK_MS)

console.log(`\n✔ ${app.name} 준비 끝 · ${origin}\n  디스코드에서 바로 눌러 보세요. 끝낼 때는 Ctrl+C`)
