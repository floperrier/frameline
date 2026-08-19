import { sql } from 'drizzle-orm'
import { schema, useDb } from '../db'

/**
 * Resolves the Author for an OAuth identity, keyed on email so that signing in
 * with GitHub and with Google lands on the same Author.
 */
export async function resolveAuthor(email: string, name?: string | null) {
  const [author] = await useDb()
    .insert(schema.authors)
    .values({ email, name: name ?? null })
    .onConflictDoUpdate({
      target: schema.authors.email,
      set: { name: sql`coalesce(excluded.name, ${schema.authors.name})` },
    })
    .returning()

  return author!
}
