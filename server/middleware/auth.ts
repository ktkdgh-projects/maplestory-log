const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export default defineEventHandler(async (event) => {
  if (event.path.startsWith('/_nuxt/') || /\.\w+$/.test(event.path.split('?')[0]!)) return

  // SameSite=Lax 쿠키에 더해, 쓰기 요청은 다른 사이트에서 온 것을 막는다
  if (event.path.startsWith('/api/') && UNSAFE_METHODS.has(event.method)) {
    const origin = getHeader(event, 'origin')
    const fetchSite = getHeader(event, 'sec-fetch-site')
    const sameOrigin = origin
      ? origin === getRequestURL(event, { xForwardedHost: true, xForwardedProto: true }).origin
      : !fetchSite || fetchSite === 'same-origin'
    if (!sameOrigin) throw createError({ statusCode: 403, message: '허용되지 않은 요청이에요.' })
  }

  // 페이지 요청에서도 세션을 읽어야 토큰 교체 쿠키가 브라우저까지 간다 (SSR 내부 API 호출의 Set-Cookie는 버려짐)
  await loadSession(event)
})
