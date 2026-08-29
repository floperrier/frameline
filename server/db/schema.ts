import { boolean, customType, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import type { Condition, Sets } from '../../shared/utils/scenes'

// `name` is the Name an Author appears under wherever somebody else meets them:
// beside a Listed Story, on their Profile. It arrives from the provider they
// signed in with, which may hand back none, and it is theirs to rewrite — so it
// is nullable, and an Author with none is asked for one the first time they list
// a Story — see `docs/adr/0025-a-name-is-asked-for-in-the-listing.md`. `email` is
// what an Author is keyed on and is never shown to anybody, here or anywhere
// else.
//
// `avatar` is the picture the provider hands back, held as the URL it hands back
// and nothing else: no bytes, no resizing, no column of images. A Shot's Image
// lives in its row because the Image belongs to the Shot — see
// `docs/adr/0005-a-shots-image-lives-in-its-row.md` — and an avatar belongs to
// the provider, which goes on serving it: see
// `docs/adr/0026-an-avatar-is-a-url-not-bytes.md`. Null where the provider hands
// none, or for an Author who last signed in before the column existed.
export const authors = pgTable('authors', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name'),
  avatar: text('avatar'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// `opening_scene_id` is where a Reading starts. Holding it on the Story is what
// makes "one opening Scene" true by construction: a column cannot name two
// Scenes. It is null until the Story has a Scene, and again if that Scene is
// deleted.
//
// `language` is the language the work is written in, named by its Author when
// the Story is created and never the language its Author reads the editor in —
// see `docs/adr/0013-the-interfaces-locale-is-not-the-storys-language.md`. It
// holds a BCP-47 code and is not constrained to the Locales the interface has:
// a Story written in Spanish inside a French editor is an ordinary Story. The
// default is what backfills every row written before the column existed, all of
// which are English, and is also what the schema owes a rollback — see
// `docs/adr/0002-the-schema-moves-with-the-deploy.md`.
//
// `published_at` is what makes the Story readable at its public link, and null
// is what keeps it the Author's alone. A timestamp rather than a flag because it
// says when as well as whether, at no more cost. Nothing else changes on a
// Publish — the link is the Story's own id, so it is the same link every time
// the Story is published again.
//
// `listed` is whether the Author has put the published Story in the Catalogue,
// which is a second act beside publishing rather than part of it — see
// `docs/adr/0023-being-published-and-being-found-are-two-acts.md`. A flag beside
// `published_at` rather than one column naming three states, because
// `published_at` already says which side of publishing the Story is on. It
// defaults to false and nothing backfills it: nobody agreed to appear in a
// catalogue that did not exist when they published.
export const stories = pgTable('stories', {
  id: uuid('id').primaryKey().defaultRandom(),
  authorId: uuid('author_id').notNull().references(() => authors.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  language: text('language').notNull().default('en'),
  openingSceneId: uuid('opening_scene_id')
    .references((): AnyPgColumn => scenes.id, { onDelete: 'set null' }),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  listed: boolean('listed').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// `x` and `y` are where the Author put the Scene's node in the Story graph, in
// pixels from the graph's top left. They say nothing about the Story itself —
// two Scenes may sit on top of each other — so nothing constrains them beyond
// the reach of the graph.
//
// `sets` is the Flags the Scene sets on every entry, as one flat object of names
// to values — or, where the Author named several, to the list one value is drawn
// from on each entry. A table of its own would be the orthodox shape, but a
// Scene's Flags are only ever read and written whole, with the Scene — never
// queried across Stories, never joined to anything — so a row apiece would buy a
// join and nothing else. What keeps the shape honest is the validation at the
// request boundary, since Postgres will take any jsonb at all.
export const scenes = pgTable('scenes', {
  id: uuid('id').primaryKey().defaultRandom(),
  storyId: uuid('story_id').notNull().references(() => stories.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  x: integer('x').notNull().default(0),
  y: integer('y').notNull().default(0),
  sets: jsonb('sets').$type<Sets>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// The bytes of an image, which drizzle has no column for; the neon-http
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
// `image` is the image the Shot shows, held in the Shot's own row and null for a
// Shot that is text alone. The bytes live here rather than in object storage
// because an image is only as reachable as the Story it belongs to — see
// `docs/adr/0005-a-shots-image-lives-in-its-row.md`.
//
// `description` is what that image shows, for a Reader who cannot see it. It
// sits beside the bytes rather than in a table of its own because it is the one
// thing said about the one image, and empty is an Image nobody has described —
// which is what a Shot of text alone carries too.
//
// `conditions` are the flat tests the Shot plays under, all of which must hold;
// an empty list is a Shot every Reading sees. Held as jsonb, validated at the
// request boundary and naming a Scene by an id no foreign key reaches, for the
// same reasons an Exit's are — see the Exit below. A Shot skipped by one of these
// is still a linear run and not a branch, so
// `docs/adr/0001-branching-only-between-scenes.md` is untouched.
//
// It defaults to the empty list, which nothing here needs — every Shot is
// written with the tests it carries. The default is for the code that ran before
// this column existed: the schema moves before the deploy and a rollback moves
// the code back alone, so for a while an insert naming no Conditions has to
// succeed rather than take adding a Shot down with it — see
// `docs/adr/0002-the-schema-moves-with-the-deploy.md`.
export const shots = pgTable('shots', {
  id: uuid('id').primaryKey().defaultRandom(),
  sceneId: uuid('scene_id').notNull().references(() => scenes.id, { onDelete: 'cascade' }),
  text: text('text').notNull().default(''),
  position: integer('position').notNull(),
  image: bytea('image'),
  description: text('description').notNull().default(''),
  conditions: jsonb('conditions').$type<Condition[]>().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// An Exit is an edge of the Story graph: it leaves one Scene for another and
// carries the text the Reader is offered. Both ends cascade, so deleting a Scene
// takes the Exits that touch it with it. Two Exits may join the same pair of
// Scenes — they differ by their Conditions — so nothing here is unique.
//
// `conditions` are the flat tests the Exit is offered under, all of which must
// hold; an empty list is an Exit always offered. Held as jsonb for the same reason
// as a Scene's Flags: it is read and written whole with the Exit, and the shape is
// kept by the request boundary rather than by columns. A Condition naming a Scene
// holds its id in the json, where no foreign key reaches — a Scene deleted out
// from under it leaves a Condition counting visits to nowhere, which is a
// Condition that never passes.
//
// `position` is the Scene's own numbering of the ways on leaving it: 0, 1, 2
// with no gaps, the same Place a Shot has in its Scene's run. The Reader is
// offered the Exits in this order and the first of them takes focus, so it is a
// decision about the Story rather than about the drawing — the graph's `x` and
// `y` say nothing about it, see
// `docs/adr/0007-the-order-of-the-ways-on-is-written-not-drawn.md`. Kept without
// a unique constraint for the reason a Shot's numbering is.
//
// It defaults to 0, which nothing here needs — every Exit is drawn with the Place
// it takes. The default is for the code that ran before this column existed: the
// schema moves before the deploy and a rollback moves the code back alone, so
// for a while an insert naming no Place has to succeed rather than take drawing
// an Exit down with it — see
// `docs/adr/0002-the-schema-moves-with-the-deploy.md`.
export const exits = pgTable('exits', {
  id: uuid('id').primaryKey().defaultRandom(),
  fromSceneId: uuid('from_scene_id').notNull().references(() => scenes.id, { onDelete: 'cascade' }),
  toSceneId: uuid('to_scene_id').notNull().references(() => scenes.id, { onDelete: 'cascade' }),
  text: text('text').notNull().default(''),
  conditions: jsonb('conditions').$type<Condition[]>().notNull().default([]),
  position: integer('position').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// A Comment is what one Author writes to another about a published Story. It
// names the Story and never a Scene or a Shot: there is no `scene_id` here and
// no `shot_id`, so the thing the glossary refuses cannot be written by a handler
// that forgets — see
// `docs/adr/0027-a-comment-is-said-of-the-whole-story.md`.
//
// Both ends cascade. A Story deleted takes what was said under it, because a
// Comment about a Story nobody can read is a sentence about nothing; an account
// deleted takes what its Author said, because every Comment is signed and an
// unsigned one is the one thing a Comment is not.
//
// `created_at` is the whole of the ordering: Comments are read oldest first, the
// way a conversation is read. Nothing here is a score, a rating or a count —
// there is no column one could be kept in.
export const comments = pgTable('comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  storyId: uuid('story_id').notNull().references(() => stories.id, { onDelete: 'cascade' }),
  authorId: uuid('author_id').notNull().references(() => authors.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
