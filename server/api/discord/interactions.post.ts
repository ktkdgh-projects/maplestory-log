import type { H3Event } from 'h3'
import { verifyDiscordSignature } from '../../utils/discord/verify'
import { PARTY_CHARACTER, PARTY_OLD_PAGES, PARTY_REFRESH, RESPONSE, askPartyCharacter, connectParty, openOldPartyPage, partyNotice, refreshParty, savePartyCharacter, type DiscordInteraction } from '../../utils/discord/party'
import { castPartyVote } from '../../utils/discord/week'
import { runLeaderAction } from '../../utils/discord/leader'
import { askPartyChangeReason, cancelPartyChange, okPartyChange, openPartyChange, pickPartyChange, submitPartyChange } from '../../utils/discord/change'

const INTERACTION = { ping: 1, command: 2, component: 3, modalSubmit: 5 } as const
type Handler = (interaction: DiscordInteraction, event: H3Event) => unknown

// id가 이 글자로 시작하는 버튼·선택 메뉴
const COMPONENTS: [string, Handler][] = [
  [PARTY_CHARACTER, askPartyCharacter],
  [PARTY_REFRESH, refreshParty],
  ...Object.keys(PARTY_OLD_PAGES).map((id): [string, Handler] => [id, openOldPartyPage]),
  ['lead:', runLeaderAction],
  ['vote:', castPartyVote],
  ['chg:open:', openPartyChange],
  ['chg:sel:', pickPartyChange],
  ['chg:reason:', askPartyChangeReason],
  ['chg:ok:', okPartyChange],
  ['chg:cancel:', cancelPartyChange],
]
// 모달 제출
const MODALS: [string, Handler][] = [
  [PARTY_CHARACTER, savePartyCharacter],
  ['chg:submit:', submitPartyChange],
]

// 디스코드 버튼·명령이 들어오는 곳. 메이플로그 로그인과 상관없이 디스코드 서명으로만 확인한다
export default defineEventHandler(async (event) => {
  const { discordPublicKey } = useRuntimeConfig()
  const body = await readRawBody(event, 'utf8') ?? ''
  const signature = getHeader(event, 'x-signature-ed25519') ?? ''
  const timestamp = getHeader(event, 'x-signature-timestamp') ?? ''
  if (!discordPublicKey || !verifyDiscordSignature(body, signature, timestamp, discordPublicKey)) {
    throw createError({ statusCode: 401, message: 'invalid request signature' })
  }

  const interaction = JSON.parse(body) as DiscordInteraction
  if (interaction.type === INTERACTION.ping) return { type: RESPONSE.pong }

  const id = interaction.data?.custom_id ?? ''
  try {
    if (interaction.type === INTERACTION.command && interaction.data?.name === '파티') return await connectParty(interaction, event)
    const routes = interaction.type === INTERACTION.component ? COMPONENTS : interaction.type === INTERACTION.modalSubmit ? MODALS : []
    const handler = routes.find(([prefix]) => id.startsWith(prefix))?.[1]
    return handler ? await handler(interaction, event) : partyNotice('아직 없는 기능이에요.')
  }
  catch (error) {
    console.error('[leda] 처리 실패', String((error as Error)?.message ?? error))
    return partyNotice('잠시 문제가 생겼어요. 다시 눌러 주세요.')
  }
})
