import { customType, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import type { Condition, Flags } from '../../shared/utils/scenes'

export const authors = pgTable('authors', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// `opening_scene_id` is where a Reading starts. Holding it on the Story is what
// makes "one opening Scene" true by construction: a column cannot name two
// Scenes. It is null until the Story has a Scene, and again if that Scene is
// deleted.
//
// `published_at` is what makes the Story readable at its public link, and null
// is what keeps it the Author's alone. A timestamp rather than a flag because it
// says when as well as whether, at no more cost. Nothing else changes on a
// Publish — the link is the Story's own id, so it is the same link every time
// the Story is published again.
export const stories = pgTable('stories', {
  id: uuid('id').primaryKey().defaultRandom(),
  authorId: uuid('author_id').notNull().references(() => authors.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  openingSceneId: uuid('opening_scene_id')
    .references((): AnyPgColumn => scenes.id, { onDelete: 'set null' }),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// `x` and `y` are where the Author put the Scene's node in the Story graph, in
// pixels from the graph's top left. They say nothing about the Story itself —
// two Scenes may sit on top of each other — so nothing constrains them beyond
// the reach of the graph.
//
// `sets` is the Flags the Scene sets on every entry, as one flat object of names
// to values. A table of its own would be the orthodox shape, but a Scene's Flags
// are only ever read and written whole, with the Scene — never queried across
// Stories, never joined to anything — so a row apiece would buy a join and
// nothing else. What keeps the shape honest is the validation at the request
// boundary, since Postgres will take any jsonb at all.
export const scenes = pgTable('scenes', {
  id: uuid('id').primaryKey().defaultRandom(),
  storyId: uuid('story_id').notNull().references(() => stories.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  x: integer('x').notNull().default(0),
  y: integer('y').notNull().default(0),
  sets: jsonb('sets').$type<Flags>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// The bytes of a still image, which drizzle has no column for; the neon-http
// driver hands a `bytea` back as a Buffer and takes one as a parameter, so
// nothing is encoded on the way past.
const bytea = customType<{ data: Buffer, driverData: Buffer }>({ dataType: () => 'bytea' })

// `position` is the Scene's own numbering of its Shots: 0, 1, 2 with no gaps.
// Nothing else in a Shot says where it comes, and the Reader plays the run in
// this order.
//
// ponytail: no `unique (scene_id, position)`. It would be the natural guard, but
// Postgres checks a unique index row by row, so the single statement that swaps
// two Shots would trip over it; only a deferrable constraint, which drizzle-kit
// will not generate, holds off until the statement ends. The numbering is kept
// by writing each change as one statement instead. Two people editing one Scene
// at once could still collide — add the deferrable constraint by hand the day a
// Story has more than its one Author.
//
// `image` is the still the Shot shows, held in the Shot's own row and null for a
// Shot that is text alone. The bytes live here rather than in object storage
// because an image is only as reachable as the Story it belongs to — see
// `docs/adr/0005-a-shots-image-lives-in-its-row.md`.
//
// `description` is what that still shows, for a Reader who cannot see it. It
// sits beside the bytes rather than in a table of its own because it is the one
// thing said about the one still, and empty is a Still nobody has described —
// which is what a Shot of text alone carries too.
export const shots = pgTable('shots', {
  id: uuid('id').primaryKey().defaultRandom(),
  sceneId: uuid('scene_id').notNull().references(() => scenes.id, { onDelete: 'cascade' }),
  text: text('text').notNull().default(''),
  position: integer('position').notNull(),
  image: bytea('image'),
  description: text('description').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// A Cut is an edge of the Story graph: it leaves one Scene for another and
// carries the text the Reader is offered. Both ends cascade, so deleting a Scene
// takes the Cuts that touch it with it. Two Cuts may join the same pair of
// Scenes — they differ by their Conditions — so nothing here is unique.
//
// `conditions` are the flat tests the Cut is offered under, all of which must
// hold; an empty list is a Cut always offered. Held as jsonb for the same reason
// as a Scene's Flags: it is read and written whole with the Cut, and the shape is
// kept by the request boundary rather than by columns. A Condition naming a Scene
// holds its id in the json, where no foreign key reaches — a Scene deleted out
// from under it leaves a Condition counting visits to nowhere, which is a
// Condition that never passes.
//
// `position` is the Scene's own numbering of the ways on leaving it: 0, 1, 2
// with no gaps, the same Place a Shot has in its Scene's run. The Reader is
// offered the Cuts in this order and the first of them takes focus, so it is a
// decision about the Story rather than about the drawing — the graph's `x` and
// `y` say nothing about it, see
// `docs/adr/0007-the-order-of-the-ways-on-is-written-not-drawn.md`. Kept without
// a unique constraint for the reason a Shot's numbering is.
//
// It defaults to 0, which nothing here needs — every Cut is drawn with the Place
// it takes. The default is for the code that ran before this column existed: the
// schema moves before the deploy and a rollback moves the code back alone, so
// for a while an insert naming no Place has to succeed rather than take drawing
// a Cut down with it — see
// `docs/adr/0002-the-schema-moves-with-the-deploy.md`.
//
// `condition` is what a Cut carried before it could carry several, and nothing
// reads it any more. It stays for one deploy because the schema moves before the
// code does and a rollback moves the code back alone — see
// `docs/adr/0002-the-schema-moves-with-the-deploy.md`. The migration that drops
// it is the next deploy's, not this one's.
export const cuts = pgTable('cuts', {
  id: uuid('id').primaryKey().defaultRandom(),
  fromSceneId: uuid('from_scene_id').notNull().references(() => scenes.id, { onDelete: 'cascade' }),
  toSceneId: uuid('to_scene_id').notNull().references(() => scenes.id, { onDelete: 'cascade' }),
  text: text('text').notNull().default(''),
  conditions: jsonb('conditions').$type<Condition[]>().notNull().default([]),
  position: integer('position').notNull().default(0),
  condition: jsonb('condition').$type<Condition>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
