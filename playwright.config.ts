import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: 'http://localhost:3101' },
  webServer: {
    command: 'pnpm build && pnpm preview',
    url: 'http://localhost:3101',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      PORT: '3101',
      NUXT_SESSION_PASSWORD: 'e2e-session-password-at-least-32-chars',
    },
  },
})
