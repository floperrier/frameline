import { existsSync } from 'node:fs'
import { defineConfig } from '@playwright/test'

// The tests seal their own session cookie and seed their own Author, so they need
// the same password and database the preview server is about to use. The
// database is the suite's own, which `pnpm test:db` starts, rather than the one
// `.env` names for `pnpm dev` — see
// `docs/adr/0082-development-brings-its-own-database.md`; a `DATABASE_URL` in
// the environment still wins. The bucket is the suite's own for the same reason,
// started beside the database — see
// `docs/adr/0092-images-and-sounds-live-in-a-private-bucket.md` — and a spec
// reads its endpoint to know the host a signed address points at. The password
// comes from `.env` — Nuxt loads it for us everywhere else — and CI supplies it
// directly instead.
process.env.DATABASE_URL ??= 'postgres://postgres:postgres@db.localtest.me:4445/main'
process.env.NUXT_MEDIA_ENDPOINT ??= 'http://localhost:4447'
process.env.NUXT_MEDIA_BUCKET ??= 'media'
process.env.NUXT_MEDIA_ACCESS_KEY_ID ??= 'frameline'
process.env.NUXT_MEDIA_SECRET_ACCESS_KEY ??= 'frameline-secret'
if (existsSync('.env')) process.loadEnvFile('.env')

if (!process.env.NUXT_SESSION_PASSWORD) {
  throw new Error('NUXT_SESSION_PASSWORD is not set — copy .env.example to .env')
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
  // A test that fails once by chance would otherwise decide whether a change
  // lands, and in CI a red run costs a repair agent and a second run over a race
  // the change never came near. So CI runs a failed test again, up to twice: one
  // that passes on a retry is still reported as flaky, in the log and in the
  // report, with the trace of the attempt that failed, and one that fails all
  // three times is still red. A development machine keeps none: there a run is
  // watched, and a flake should be seen failing.
  retries: process.env.CI ? 2 : 0,
  // Every spec but one runs side by side, because nothing they hold is shared.
  // The one is the ceiling's: it fills the whole instance to one byte short of
  // nine gigabytes, a state in which every other spec's upload would be refused,
  // so it runs alone once they have all finished — see
  // `docs/adr/0092-images-and-sounds-live-in-a-private-bucket.md`. Named alone, it
  // still waits on the whole of `everything`; `--no-deps` runs it by itself.
  projects: [
    { name: 'everything', testIgnore: /ceiling-signed-in\.spec\.ts$/ },
    { name: 'ceiling', testMatch: /ceiling-signed-in\.spec\.ts$/, dependencies: ['everything'] },
  ],
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
      NUXT_MEDIA_ENDPOINT: process.env.NUXT_MEDIA_ENDPOINT,
      NUXT_MEDIA_BUCKET: process.env.NUXT_MEDIA_BUCKET,
      NUXT_MEDIA_ACCESS_KEY_ID: process.env.NUXT_MEDIA_ACCESS_KEY_ID,
      NUXT_MEDIA_SECRET_ACCESS_KEY: process.env.NUXT_MEDIA_SECRET_ACCESS_KEY,
    },
  },
})
