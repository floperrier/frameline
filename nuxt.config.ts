export default defineNuxtConfig({
  modules: ['nuxt-auth-utils'],
  compatibilityDate: '2026-08-19',
  runtimeConfig: {
    databaseUrl: '',
    oauth: {
      github: { clientId: '', clientSecret: '' },
      google: { clientId: '', clientSecret: '' },
    },
  },
})
