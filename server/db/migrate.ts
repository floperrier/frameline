// Applies the migrations to the end-to-end suite's own database, through the
// driver the app itself uses. `drizzle-kit migrate` speaks to Neon over a
// WebSocket and can be pointed nowhere else, which is right for the deploy and
// no use for a Postgres behind a local proxy; drizzle's own migrator is what
// `drizzle-kit migrate` runs underneath, over the same files and the same
// journal — see `docs/adr/0075-the-suite-brings-its-own-database.md`.
//
//   DATABASE_URL=postgres://postgres:postgres@db.localtest.me:4445/main node server/db/migrate.ts
import { drizzle } from 'drizzle-orm/neon-http'
import { migrate } from 'drizzle-orm/neon-http/migrator'
import { routeToLocalProxy } from './endpoint.ts'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set')

routeToLocalProxy()

await migrate(drizzle(url), { migrationsFolder: 'server/db/migrations' })
console.log('Migrations applied.')
