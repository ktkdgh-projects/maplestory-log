// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  css: ['~/assets/css/tokens.css'],

  app: {
    head: {
      htmlAttrs: { lang: 'ko' },
      title: 'MAPLE LOG',
      link: [
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
    adminAccountIds: '',
    public: {},
  },
})
