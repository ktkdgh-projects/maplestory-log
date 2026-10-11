const CONTENT_SECURITY_POLICY = [
  `default-src 'self'`,
  // SSR 인라인 스크립트(window.__NUXT__) 때문에 필요. nonce는 요청마다 HTML을 고쳐야 해서 보류
  `script-src 'self' 'unsafe-inline'`,
  `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
  `font-src 'self' https://fonts.gstatic.com`,
  // lwi.nexon.com: 썬데이 메이플 공지 본문 이미지
  `img-src 'self' data: https://open.api.nexon.com https://lwi.nexon.com`,
  `connect-src 'self'`,
  `frame-ancestors 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
].join('; ')

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  css: ['~/assets/css/tokens.css', '~/assets/css/base.css', '~/assets/css/calc.css'],

  // 폴더는 묶음용. 파일 이름이 곧 태그 이름 (ui/AppModal.vue → <AppModal>)
  components: [{ path: '~/components', pathPrefix: false }],

  app: {
    pageTransition: { name: 'page', mode: 'out-in' },
    head: {
      htmlAttrs: { lang: 'ko' },
      title: '메이플스토리로그',
      meta: [
        { name: 'description', content: '메이플스토리 캐릭터의 하루하루를 게임 화면처럼 기록하는 개인 기록장' },
        { name: 'theme-color', content: '#141828' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Do+Hyeon&family=Nanum+Gothic:wght@400;700;800&family=Silkscreen&display=swap',
        },
      ],
    },
  },

  // 빈 값은 자리만 잡아둔 것. 실행 시 NUXT_NEXON_API_KEY → nexonApiKey 식으로 환경 변수가 채운다
  runtimeConfig: {
    nexonApiKey: '',
    mongoUri: '',
    cronSecret: '',
    keyEncSecret: '',
    keyHashSecret: '',
    // 관리자 넥슨 계정 id. 여러 명이면 쉼표로 구분 (NUXT_ADMIN_ACCOUNT_IDS)
    adminAccountIds: '',
    public: {},
  },

  nitro: {
    vercel: { functions: { maxDuration: 60 } },
    typescript: {
      tsConfig: { compilerOptions: { noUnusedLocals: true, noUnusedParameters: true } },
    },
  },

  typescript: {
    tsConfig: { compilerOptions: { noUnusedLocals: true, noUnusedParameters: true } },
  },

  // dev 서버는 HMR에 eval·websocket이 필요해서 운영에만 건다
  $production: {
    routeRules: {
      '/**': {
        headers: {
          'Content-Security-Policy': CONTENT_SECURITY_POLICY,
          'X-Content-Type-Options': 'nosniff',
          'Referrer-Policy': 'strict-origin-when-cross-origin',
          'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
          'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
          'X-Frame-Options': 'DENY',
          'Cross-Origin-Opener-Policy': 'same-origin',
        },
      },
    },
  },
})
