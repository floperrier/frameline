import { neonConfig } from '@neondatabase/serverless'

let routed = false

// The end-to-end suite runs against a Postgres of its own, in CI and on a
// development machine, behind a proxy that speaks Neon's HTTP protocol — never
// against Neon, whose free quota is the one production runs on: see
// `docs/adr/0075-the-suite-brings-its-own-database.md`. A connection string
// naming `db.localtest.me`, which resolves to the machine itself, is sent to that
// proxy, on the port the string carries. Every other host reaches Neon exactly as
// the driver would have sent it there.
//
// A function to call rather than a module imported for its effect: Nitro takes
// every module of the server for one without effects unless told otherwise, and
// dropped the import from the build without a word.
export function routeToLocalProxy() {
  if (routed) return
  routed = true
  const remote = neonConfig.fetchEndpoint
  neonConfig.fetchEndpoint = (host, port, options) =>
    host === 'db.localtest.me'
      ? `http://${host}:${port}/sql`
      : typeof remote === 'function' ? remote(host, port, options) : remote
}
