import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'

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
export const stories = pgTable('stories', {
  id: uuid('id').primaryKey().defaultRandom(),
  authorId: uuid('author_id').notNull().references(() => authors.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  openingSceneId: uuid('opening_scene_id')
    .references((): AnyPgColumn => scenes.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// `x` and `y` are where the Author put the Scene's node in the Story graph, in
// pixels from the graph's top left. They say nothing about the Story itself —
// two Scenes may sit on top of each other — so nothing constrains them beyond
// the reach of the graph.
export const scenes = pgTable('scenes', {
  id: uuid('id').primaryKey().defaultRandom(),
  storyId: uuid('story_id').notNull().references(() => stories.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  x: integer('x').notNull().default(0),
  y: integer('y').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

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
export const shots = pgTable('shots', {
  id: uuid('id').primaryKey().defaultRandom(),
  sceneId: uuid('scene_id').notNull().references(() => scenes.id, { onDelete: 'cascade' }),
  text: text('text').notNull().default(''),
  position: integer('position').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// A Cut is an edge of the Story graph: it leaves one Scene for another and
// carries the text the Reader is offered. Both ends cascade, so deleting a Scene
// takes the Cuts that touch it with it. Two Cuts may join the same pair of
// Scenes — one day they will differ by their Conditions — so nothing here is
// unique.
export const cuts = pgTable('cuts', {
  id: uuid('id').primaryKey().defaultRandom(),
  fromSceneId: uuid('from_scene_id').notNull().references(() => scenes.id, { onDelete: 'cascade' }),
  toSceneId: uuid('to_scene_id').notNull().references(() => scenes.id, { onDelete: 'cascade' }),
  text: text('text').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
