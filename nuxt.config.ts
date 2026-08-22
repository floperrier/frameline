export default defineNuxtConfig({
  modules: ['nuxt-auth-utils', '@nuxt/fonts'],
  compatibilityDate: '2026-08-19',
  css: ['~/assets/css/frameline.css'],
  // The four faces the design uses, each with only the weights it is set in, so
  // the build downloads and self-hosts those files and nothing else. Named here
  // rather than left to be discovered, because a face the module cannot find has
  // to fall back to the stack written beside it in the CSS, and that is worth
  // knowing at build time rather than on screen.
  fonts: {
    defaults: { subsets: ['latin'], styles: ['normal'] },
    // Every face is reached through a custom property, and the module only looks
    // at literal `font-family` values unless it is told to follow variables.
    // Without this it finds nothing to download and the whole design falls back
    // to the stacks written beside the tokens.
    experimental: { processCSSVariables: true },
    families: [
      { name: 'Big Shoulders', provider: 'google', weights: [600] },
      { name: 'IBM Plex Sans', provider: 'google', weights: [400, 500, 600] },
      { name: 'IBM Plex Mono', provider: 'google', weights: [400, 500] },
      { name: 'Newsreader', provider: 'google', weights: [300, 400] },
    ],
  },
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
