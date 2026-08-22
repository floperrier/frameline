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
  // The suite addresses elements by their accessible name and their visible
  // text, and the interface is read in the language the browser announces, so
  // the language of the machine running the tests would otherwise decide which
  // words the selectors are looking for. English is what the specs are written
  // in; the one spec that wants French says so itself.
  use: { baseURL: 'http://localhost:3101', locale: 'en-US' },
  webServer: {
    command: 'pnpm build && pnpm preview',
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
