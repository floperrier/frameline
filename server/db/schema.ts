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
export const shots = pgTable('shots', {
  id: uuid('id').primaryKey().defaultRandom(),
  sceneId: uuid('scene_id').notNull().references(() => scenes.id, { onDelete: 'cascade' }),
  text: text('text').notNull().default(''),
  position: integer('position').notNull(),
  image: bytea('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// A Cut is an edge of the Story graph: it leaves one Scene for another and
// carries the text the Reader is offered. Both ends cascade, so deleting a Scene
// takes the Cuts that touch it with it. Two Cuts may join the same pair of
// Scenes — they differ by their Conditions — so nothing here is unique.
//
// `condition` is the flat test the Cut is offered under, null being a Cut always
// offered. Held as jsonb for the same reason as a Scene's Flags: it is read and
// written whole with the Cut, and the shape is kept by the request boundary
// rather than by columns. A Condition naming a Scene holds its id in the json,
// where no foreign key reaches — a Scene deleted out from under it leaves a
// Condition counting visits to nowhere, which is a Condition that never passes.
export const cuts = pgTable('cuts', {
  id: uuid('id').primaryKey().defaultRandom(),
  fromSceneId: uuid('from_scene_id').notNull().references(() => scenes.id, { onDelete: 'cascade' }),
  toSceneId: uuid('to_scene_id').notNull().references(() => scenes.id, { onDelete: 'cascade' }),
  text: text('text').notNull().default(''),
  condition: jsonb('condition').$type<Condition>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
