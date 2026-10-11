const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export default defineEventHandler(async (event) => {
  // 정적 파일은 건너뛰되, API는 경로가 .xxx로 끝나도 Origin 검사와 세션을 거치게 한다
  if (event.path.startsWith('/_nuxt/') || (!event.path.startsWith('/api/') && /\.\w+$/.test(event.path.split('?')[0]!))) return

  // SameSite=Lax 쿠키에 더해, 쓰기 요청은 다른 사이트에서 온 것을 막는다
  if (event.path.startsWith('/api/') && UNSAFE_METHODS.has(event.method)) {
    const origin = getHeader(event, 'origin')
    const fetchSite = getHeader(event, 'sec-fetch-site')
    const sameOrigin = origin
      ? origin === getRequestURL(event, { xForwardedHost: true, xForwardedProto: true }).origin
      : !fetchSite || fetchSite === 'same-origin'
    if (!sameOrigin) throw createError({ statusCode: 403, message: '허용되지 않은 요청이에요.' })
  }

  // SSR 내부 API 호출의 Set-Cookie는 버려져서 페이지 요청에서도 세션을 읽어야 토큰 교체 쿠키가 간다
  await loadSession(event)
})
