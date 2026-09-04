import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  modules: ['nuxt-auth-utils', '@nuxt/fonts', '@nuxtjs/i18n'],
  compatibilityDate: '2026-08-19',
  css: ['~/assets/css/frameline.css'],
  // The widths the interface folds at are declared once, in
  // `app/assets/css/folds.css`, and reached by name from the scoped block of
  // every surface that folds. A media query's condition is the one thing plain
  // CSS gives no way to share — a custom property cannot be read inside one —
  // and this plugin is Media Queries Level 5's own answer to that, so `44rem`
  // and `74rem` are written in one file rather than in five.
  postcss: { plugins: { 'postcss-custom-media': {} } },
  // Two languages the interface is read in, and one the strings are written in:
  // English is the `defaultLocale`, so it is what an unprefixed URL serves and
  // what a new key is authored in. French is reached at `/fr/...`.
  //
  // The Reader's page opts out of localized routing in the page itself, so the
  // public link stays `/read/<id>` — see
  // `docs/adr/0012-the-public-link-carries-no-locale.md`.
  i18n: {
    locales: [
      { code: 'en', language: 'en', name: 'English', file: 'en.json' },
      { code: 'fr', language: 'fr', name: 'Français', file: 'fr.json' },
    ],
    defaultLocale: 'en',
    strategy: 'prefix_except_default',
    // `all` rather than the recommended `root`: the Author is the only person
    // who comes back, and they come back to a link deep in the editor, which
    // `root` would leave in English whatever their browser says. An explicit
    // choice lands in the cookie and is not overridden afterwards.
    detectBrowserLanguage: {
      useCookie: true,
      redirectOn: 'all',
      alwaysRedirect: false,
      fallbackLocale: 'en',
    },
  },
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
  // The Samples' images, which planting reads as it writes a Sample into a new
  // account. They are committed WebP files beside the work rather than developed
  // at planting time — see
  // `docs/adr/0018-a-leader-exists-once-per-language.md` — and the deployed
  // bundle is not the repository, so they ride in as a server asset instead of
  // being read off a path that does not survive the build.
  nitro: {
    serverAssets: [{
      baseName: 'samples',
      dir: fileURLToPath(new URL('demonstration/images', import.meta.url)),
    }],
  },
  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL ?? '',
    // The published Story the landing page sends a visitor to read, named by
    // `NUXT_PUBLIC_LANDING_STORY` rather than written into the page: which
    // Sample is published is a fact about the deployment, not about the code.
    // Unset, the link is not shown, so there is no dead link to reach.
    public: { landingStory: '' },
    oauth: {
      github: { clientId: '', clientSecret: '' },
      google: { clientId: '', clientSecret: '' },
    },
  },
})
