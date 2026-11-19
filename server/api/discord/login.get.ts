import { startBotLogin } from '../../utils/discord/webAuth'

// 레다봇 화면을 처음 열면 디스코드 승인 화면으로 보낸다
export default defineEventHandler(event => sendRedirect(event, startBotLogin(event, getQuery(event).next)))
