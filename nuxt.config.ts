export default defineNuxtConfig({
  modules: ['nuxt-auth-utils'],
  compatibilityDate: '2026-08-19',
  runtimeConfig: {
    databaseUrl: '',
    oauth: {
      github: { clientId: '', clientSecret: '', scope: ['user:email'] },
      google: { clientId: '', clientSecret: '', scope: ['email', 'profile'] },
    },
  },
})
