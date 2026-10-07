import { neonConfig } from '@neondatabase/serverless'
import { describe, expect, it } from 'vitest'
import { routeToLocalProxy } from '../../server/db/endpoint'

type Endpoint = (host: string, port: number | string) => string

/**
 * Where the serverless driver sends a query. The suite's own database sits behind
 * a local proxy, and production's on Neon; the one function that tells them apart
 * by the host a connection string names is the only thing standing between a
 * test run and production, so what it leaves alone is held here as firmly as
 * what it changes.
 */
describe('where a query is sent', () => {
  const remote = neonConfig.fetchEndpoint as Endpoint
  routeToLocalProxy()
  const routed = neonConfig.fetchEndpoint as Endpoint

  it('sends db.localtest.me to the local proxy, on the port the string carries', () => {
    expect(routed('db.localtest.me', 4445)).toBe('http://db.localtest.me:4445/sql')
  })

  it('sends a Neon host exactly where the driver would have', () => {
    for (const host of [
      'ep-polished-dream-zaq6bom2.c-2.eu-west-2.aws.neon.tech',
      'ep-polished-dream-zaq6bom2-pooler.c-2.eu-west-2.aws.neon.tech',
    ]) expect(routed(host, 5432)).toBe(remote(host, 5432))
  })

  it('routes once, however often it is asked', () => {
    routeToLocalProxy()
    expect(neonConfig.fetchEndpoint).toBe(routed)
  })
})
