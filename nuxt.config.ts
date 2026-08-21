export default defineNuxtConfig({
  modules: ['nuxt-auth-utils'],
  compatibilityDate: '2026-08-19',
  // Port 3000 is taken on this machine, and the OAuth redirect URIs are
  // registered against 3100.
  devServer: { port: 3100 },
  // A public link can be taken away, so nothing served on one may be held in a
  // cache that outlives the Publish: a Reader's own browser keeping the page is
  // enough to make an unpublished Story go on answering.
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
