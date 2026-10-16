import { defineConfig } from 'drizzle-kit'

const url = process.env.DATABASE_URL

// The databases on a development machine, the suite's and `pnpm dev`'s, sit
// behind a proxy that speaks Neon's protocol at `db.localtest.me`, as
// `server/db/endpoint.ts` says. drizzle-kit reaches Postgres over the serverless
// driver's WebSocket, which expects Neon's TLS on 443; for that host it goes to
// the proxy's own WebSocket instead, on the port the string carries. drizzle-kit
// imports the driver's ES module while this file is loaded as CommonJS, so the
// settings go on the instance `import()` returns, which is drizzle-kit's own, and
// they are in place before drizzle-kit has finished importing it.
if (url && new URL(url).hostname === 'db.localtest.me') {
  void import('@neondatabase/serverless').then(({ neonConfig }) => {
    neonConfig.wsProxy = (host, port) => `${host}:${port}/v2`
    neonConfig.useSecureWebSocket = false
    neonConfig.pipelineConnect = false
    neonConfig.pipelineTLS = false
  })
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './server/db/schema.ts',
  out: './server/db/migrations',
  dbCredentials: { url: url! },
})
