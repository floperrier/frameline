import { existsSync } from 'node:fs'
import { defineConfig } from '@playwright/test'

// The tests seal their own session cookie and seed their own Author, so they need
// the same password and database the preview server is about to use. Loading
// `.env` here — Nuxt does it for us everywhere else — keeps one source for both,
// and CI can supply the two variables directly instead.
if (existsSync('.env')) process.loadEnvFile('.env')

for (const name of ['NUXT_SESSION_PASSWORD', 'DATABASE_URL'] as const) {
  if (!process.env[name]) throw new Error(`${name} is not set — run \`neon env pull\``)
}

export default defineConfig({
  testDir: './tests/e2e',
  // A red run has to explain itself. The list is what the log reads as it goes,
  // and the HTML report is the directory `.github/workflows/ci.yml` uploads when
  // the suite fails — the default reporter writes no such directory, so the step
  // was uploading nothing and every red run was read off a log excerpt.
  reporter: [['list'], ['html', { open: 'never' }]],
  // Half the cores is Playwright's default, which is two tests at a time on a
  // GitHub runner and six minutes for two hundred of them. Nothing here is
  // shared — every test seals its own session and seeds the Author it takes away
  // again — and what the suite spends its time on is waiting for a database at
  // the other end of the network rather than for the processor, so the runner's
  // four cores are given four tests. A development machine keeps the default:
  // there a run is watched, and a browser that steals focus four at a time is
  // not what it looks like.
  workers: process.env.CI ? '100%' : undefined,
  use: {
    baseURL: 'http://localhost:3101',
    // The suite addresses elements by their accessible name and their visible
    // text, and the interface is read in the language the browser announces, so
    // the language of the machine running the tests would otherwise decide which
    // words the selectors are looking for. English is what the specs are written
    // in; the one spec that wants French says so itself.
    locale: 'en-US',
    // A race is only ever caught after it happened, so what a failure leaves
    // behind is the whole evidence: the trace carries the snapshot, the network
    // and the gesture, and the report copies it in beside the failure.
    trace: 'retain-on-failure',
  },
  webServer: {
    // CI builds in a step of its own, alongside fetching the browser, so here
    // there is only a server to start. Everywhere else the one command still
    // builds: a run on a development machine is started without thinking about
    // whether `.output` is the code being tested.
    command: process.env.CI ? 'pnpm preview' : 'pnpm build && pnpm preview',
    url: 'http://localhost:3101',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      PORT: '3101',
      NUXT_SESSION_PASSWORD: process.env.NUXT_SESSION_PASSWORD!,
      DATABASE_URL: process.env.DATABASE_URL!,
    },
  },
})
