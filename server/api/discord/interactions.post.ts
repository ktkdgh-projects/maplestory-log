import { verifyDiscordSignature } from '../../utils/discord/verify'
import { PARTY_CHARACTER, PARTY_REFRESH, RESPONSE, askPartyCharacter, connectParty, partyNotice, refreshParty, savePartyCharacter, type DiscordInteraction } from '../../utils/discord/party'

const INTERACTION = { ping: 1, command: 2, component: 3, modalSubmit: 5 } as const

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

  try {
    if (interaction.type === INTERACTION.command && interaction.data?.name === '파티') return await connectParty(interaction)
    if (interaction.type === INTERACTION.component && interaction.data?.custom_id === PARTY_CHARACTER) return await askPartyCharacter(interaction)
    if (interaction.type === INTERACTION.component && interaction.data?.custom_id === PARTY_REFRESH) return await refreshParty(interaction)
    if (interaction.type === INTERACTION.modalSubmit && interaction.data?.custom_id === PARTY_CHARACTER) return await savePartyCharacter(interaction)
    return partyNotice('아직 없는 기능이에요.')
  }
  catch (error) {
    console.error('[leda] 처리 실패', String((error as Error)?.message ?? error))
    return partyNotice('잠시 문제가 생겼어요. 다시 눌러 주세요.')
  }
})
