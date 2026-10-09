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

  // 서버 전용 값. 같은 이름의 NUXT_* 환경 변수가 실행 시 덮어쓴다 (.env.example 참고)
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
