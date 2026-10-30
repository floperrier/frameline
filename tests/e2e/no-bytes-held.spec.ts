import { neon } from '@neondatabase/serverless'
import { expect } from '@playwright/test'
import { test } from './author'

/**
 * The bytes of every Image and every Sound live in the bucket, and the database
 * holds their digests alone — see
 * `docs/adr/0092-images-and-sounds-live-in-a-private-bucket.md`. Read off the
 * suite's database as the migrations leave it, which is what production runs
 * once they are applied: no column of bytes is left for a medium to cross Neon
 * in, and no trigger is left hashing one.
 */
const sql = neon(process.env.DATABASE_URL!)

test('the schema holds no column of bytes and no trigger', async () => {
  const columns = await sql`
    select table_name || '.' || column_name as named from information_schema.columns
    where table_schema = 'public' and data_type = 'bytea'`
  expect(columns.map(({ named }) => named)).toEqual([])

  const triggers = await sql`
    select tgname from pg_trigger
    join pg_class on pg_class.oid = pg_trigger.tgrelid
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where nspname = 'public' and not tgisinternal`
  expect(triggers.map(({ tgname }) => tgname)).toEqual([])
})
