import { defineConfig } from 'vitest/config'

// Only `tests/unit`: the Playwright specs alongside them are also `*.spec.ts`,
// and Vitest would otherwise try to run them without a browser or a server.
export default defineConfig({
  test: { include: ['tests/unit/**/*.spec.ts'] },
})
