import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Only `tests/unit`: the Playwright specs alongside them are also `*.spec.ts`,
// and Vitest would otherwise try to run them without a browser or a server.
// `#shared` is Nuxt's alias, given here too for a module of `app/` that reaches
// `shared/` by it — see `app/utils/draw.ts`.
export default defineConfig({
  resolve: { alias: { '#shared': fileURLToPath(new URL('./shared', import.meta.url)) } },
  test: { include: ['tests/unit/**/*.spec.ts'] },
})
