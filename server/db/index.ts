import { drizzle } from 'drizzle-orm/neon-http'
import { routeToLocalProxy } from './endpoint'
import * as schema from './schema'

let client: ReturnType<typeof drizzle<typeof schema>> | undefined

export function useDb() {
  if (!client) {
    const url = useRuntimeConfig().databaseUrl
    if (!url) throw new Error('DATABASE_URL is not set — run `neon env pull`')
    routeToLocalProxy()
    client = drizzle(url, { schema })
  }
  return client
}
