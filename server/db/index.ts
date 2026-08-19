import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

let client: ReturnType<typeof drizzle<typeof schema>> | undefined

export function useDb() {
  if (!client) {
    const url = useRuntimeConfig().databaseUrl
    if (!url) throw new Error('DATABASE_URL is not set — run `neon env pull`')
    client = drizzle(url, { schema })
  }
  return client
}
