export default defineNuxtConfig({
  modules: ['nuxt-auth-utils'],
  compatibilityDate: '2026-08-19',
  // Port 3000 is taken on this machine, and the OAuth redirect URIs are
  // registered against 3100.
  devServer: { port: 3100 },
  // A public link can be taken away, so nothing on it may be held in a cache
  // that outlives the Publish: without this a Reader's browser keeps serving an
  // unpublished Story from its own store, and the link goes on working.
  routeRules: {
    '/read/**': { headers: { 'cache-control': 'no-store' } },
    '/api/read/**': { headers: { 'cache-control': 'no-store' } },
  },
  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL ?? '',
    oauth: {
      github: { clientId: '', clientSecret: '' },
      google: { clientId: '', clientSecret: '' },
    },
  },
})
