import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

let client: ReturnType<typeof drizzle<typeof schema>> | undefined

export function useDb() {
  if (!client) {
    const url = useRuntimeConfig().databaseUrl
    if (!url) throw new Error('NUXT_DATABASE_URL is not set')
    client = drizzle(url, { schema })
  }
  return client
}

export { schema }
