import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const authors = pgTable('authors', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const stories = pgTable('stories', {
  id: uuid('id').primaryKey().defaultRandom(),
  authorId: uuid('author_id').notNull().references(() => authors.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const scenes = pgTable('scenes', {
  id: uuid('id').primaryKey().defaultRandom(),
  storyId: uuid('story_id').notNull().references(() => stories.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// `position` is the Scene's own numbering of its Shots: 0, 1, 2 with no gaps.
// Nothing else in a Shot says where it comes, and the Reader plays the run in
// this order.
export const shots = pgTable('shots', {
  id: uuid('id').primaryKey().defaultRandom(),
  sceneId: uuid('scene_id').notNull().references(() => scenes.id, { onDelete: 'cascade' }),
  text: text('text').notNull().default(''),
  position: integer('position').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
