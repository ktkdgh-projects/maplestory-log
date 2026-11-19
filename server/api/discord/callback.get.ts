import { finishBotLogin } from '../../utils/discord/webAuth'

// 디스코드 승인 뒤 돌아오는 곳. 로그인 쿠키를 굽고 원래 열려던 화면으로 보낸다
export default defineEventHandler(async event => sendRedirect(event, await finishBotLogin(event)))
