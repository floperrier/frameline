export default defineNuxtConfig({
  modules: ['nuxt-auth-utils'],
  compatibilityDate: '2026-08-19',
  // Port 3000 is taken on this machine, and the OAuth redirect URIs are
  // registered against 3100.
  devServer: { port: 3100 },
  runtimeConfig: {
    databaseUrl: '',
    oauth: {
      github: { clientId: '', clientSecret: '' },
      google: { clientId: '', clientSecret: '' },
    },
  },
})
