import { sql } from 'drizzle-orm'
import {
  boolean,
  customType,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
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
// `synopsis` is the few lines an Author writes presenting the Story to whoever
// is deciding whether to read it, carried with the Story wherever it is
// presented. Empty is a Story nobody has written one for, and the empty string
// rather than null because there is nothing a null would say here that an empty
// Synopsis does not — every reader of this column draws it where there is
// something to draw and nothing where there is not.
//
// The default is what backfills every row written before the column existed, and
// what an insert naming no Synopsis goes on succeeding by while a rollback has
// the old code running against the new schema — see
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
// `steps_back` is what an Exit of this Story answers when it has not answered
// for itself: true, the default, is the Reading a step back crosses every Exit
// of — which is every Story written before the column existed, reading exactly
// as it read.
export const stories = pgTable('stories', {
  id: uuid('id').primaryKey().defaultRandom(),
  authorId: uuid('author_id').notNull().references(() => authors.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  language: text('language').notNull().default('en'),
  synopsis: text('synopsis').notNull().default(''),
  openingSceneId: uuid('opening_scene_id')
    .references((): AnyPgColumn => scenes.id, { onDelete: 'set null' }),
  coverShotId: uuid('cover_shot_id')
    .references((): AnyPgColumn => shots.id, { onDelete: 'set null' }),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  listed: boolean('listed').notNull().default(false),
  stepsBack: boolean('steps_back').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// The bytes of an image, which drizzle has no column for; the neon-http
// driver hands a `bytea` back as a Buffer and takes one as a parameter, so
// nothing is encoded on the way past.
const bytea = customType<{ data: Buffer, driverData: Buffer }>({ dataType: () => 'bytea' })

// `x` and `y` were where the Author put the Scene's node in the Story's graph.
// Nothing reads or writes them any more: where a Scene is drawn is read off the
// Story itself — see `docs/adr/0041-the-graph-is-drawn-from-the-story.md`. They
// stay one deploy longer, because the code running before this one still writes
// them and a column dropped from under it would take that code down — see
// `docs/adr/0002-the-schema-moves-with-the-deploy.md`. The migration that drops
// them follows.
//
// `sets` is the Flags the Scene sets on every entry, as one flat object of names
// to values — or, where the Author named several, to the list one value is drawn
// from on each entry. A table of its own would be the orthodox shape, but a
// Scene's Flags are only ever read and written whole, with the Scene — never
// queried across Stories, never joined to anything — so a row apiece would buy a
// join and nothing else. What keeps the shape honest is the validation at the
// request boundary, since Postgres will take any jsonb at all.
//
// `sound` is the Sound the Scene is heard under, held under its run and crossing
// the cut between its Shots. The bytes live here rather than in object storage
// for the reason an Image's do — see
// `docs/adr/0005-a-shots-image-lives-in-its-row.md` — and null is a Scene that
// carries none of its own.
//
// `sound_of_scene_id` is the Scene this one takes its Sound from, which is how an
// Author avoids depositing one bed twelve times. It is the Cover's own column for
// the Cover's own reason: `on delete set null`, so a Scene whose carrier is
// deleted falls silent rather than breaking. One hop and no further — a Scene
// named here carries bytes of its own, which the request boundary is what holds.
//
// `transcript` is what the Sound makes heard, for a Reader who cannot hear it,
// and `sound_loops` whether it is held in a loop until the Scene is left or
// played once and the Scene silent after. Both belong to the bytes and are read
// off the row carrying them, so a Scene that names another never has its own
// read: the same rain is transcribed once. Not null with a default apiece,
// because a rollback leaves the old code inserting Scenes that name neither —
// see `docs/adr/0002-the-schema-moves-with-the-deploy.md`. A deposited Sound
// loops until the Author says otherwise, which is what a bed usually is.
//
// `cut_after` is how long each Shot of the run stands before the cut is made,
// in milliseconds, and null is the run that waits for the press — which is every
// Story written before the column existed, reading exactly as it read.
//
// `cut_over` is how long that cut takes and `cut_through` what it passes
// through: `image`, the outgoing Shot dissolving into the next, or `black`. A
// hard cut is `cut_over` of nought, which is why there is no third value to
// write: under no duration there is nothing for `cut_through` to be true of, so
// a hard cut through black cannot be said rather than having to be refused —
// `docs/adr/0047-an-exit-says-whether-it-is-crossed-backwards.md`'s rule about
// two settings that could disagree.
//
// `exits_after` is how long the ways on stand: null until one is taken, a
// number of milliseconds after which the first one offered is taken, and nought
// for the ways on never offered at all — the Scene flowing into the next without
// asking. Three states of one fact rather than a flag beside a duration, which
// could contradict it. See
// `docs/adr/0050-the-cut-is-made-by-the-hand-or-by-the-clock.md`.
export const scenes = pgTable('scenes', {
  id: uuid('id').primaryKey().defaultRandom(),
  storyId: uuid('story_id').notNull().references(() => stories.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  x: integer('x').notNull().default(0),
  y: integer('y').notNull().default(0),
  sets: jsonb('sets').$type<Sets>().notNull().default({}),
  sound: bytea('sound'),
  soundOfSceneId: uuid('sound_of_scene_id')
    .references((): AnyPgColumn => scenes.id, { onDelete: 'set null' }),
  transcript: text('transcript').notNull().default(''),
  soundLoops: boolean('sound_loops').notNull().default(true),
  cutAfter: integer('cut_after'),
  cutOver: integer('cut_over').notNull().default(0),
  cutThrough: text('cut_through').notNull().default('image'),
  exitsAfter: integer('exits_after'),
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
// `sound` is the Sound the Shot strikes with: it plays as the beat plays, does
// not loop, and is gone. Null for a Shot that strikes with nothing. There is no
// `sound_of_shot_id` beside it, deliberately: naming exists because depositing a
// 400 KB bed twelve times is work, and a struck sound weighs 20 KB and is
// re-picked from the library in one press.
//
// `transcript` is what it makes heard, beside the bytes the way a Description
// sits beside an Image — one of each on a Shot carrying both.
//
// `cut_after`, `cut_over` and `cut_through` are this Shot's own answer about how
// it leaves the screen, and null on each is the Shot saying nothing and being cut
// as its Scene says — `steps_back` on an Exit, for `steps_back`'s own reason. The
// one answer a Scene's default cannot give is *this one waits for the press*
// while the rest of the run runs, and that is what nought is here: a Shot held
// for no time would not be seen at all, so nought cannot mean a duration. See
// `docs/adr/0050-the-cut-is-made-by-the-hand-or-by-the-clock.md`.
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
  sound: bytea('sound'),
  transcript: text('transcript').notNull().default(''),
  cutAfter: integer('cut_after'),
  cutOver: integer('cut_over'),
  cutThrough: text('cut_through'),
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
// from under it leaves a Condition asking about nowhere, which is a Condition
// that never passes.
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
//
// `steps_back` is whether a Reading crosses this Exit backwards, and it is the
// one column here that is nullable on purpose: null is the Exit answering *as
// the Story says*, which is what every Exit answers until an Author says
// otherwise. The Story's own `steps_back` is what that answer resolves to, so
// there is one fact per Exit and one default per Story rather than two settings
// that can disagree — see
// `docs/adr/0047-an-exit-says-whether-it-is-crossed-backwards.md`.
//
// `cut_over` and `cut_through` are the passage from the Scene this Exit leaves to
// the Scene it lands on, read the way a Scene's are and defaulting to the hard
// cut every Story has always made. There is no `cut_after` beside them: an Exit
// is taken rather than held, and how long the Reader has to take it is the
// leaving Scene's `exits_after`.
export const exits = pgTable('exits', {
  id: uuid('id').primaryKey().defaultRandom(),
  fromSceneId: uuid('from_scene_id').notNull().references(() => scenes.id, { onDelete: 'cascade' }),
  toSceneId: uuid('to_scene_id').notNull().references(() => scenes.id, { onDelete: 'cascade' }),
  text: text('text').notNull().default(''),
  conditions: jsonb('conditions').$type<Condition[]>().notNull().default([]),
  position: integer('position').notNull().default(0),
  stepsBack: boolean('steps_back'),
  cutOver: integer('cut_over').notNull().default(0),
  cutThrough: text('cut_through').notNull().default('image'),
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

// A List is Stories an Author has gathered under a title of their own, and
// Favourites is the List every account has from the start: the same table, with
// `title` null. One mechanism rather than two — to favourite a Story is to put
// it in that List and nothing else, so there is no `favourite` column here or
// anywhere else, and nothing that could disagree with what a List holds. See
// `docs/adr/0028-favourites-is-a-list-without-a-title.md`.
//
// A null title is what makes Favourites untitled by construction: there is no
// title for an Author to write and none for the interface to draw, so the name
// it is shown under is the interface's own word. The unique index is what makes
// it one per account, whatever wrote the row — and nothing backfills it, because
// the row is written the first time an Author's Lists are read rather than by the
// sign-in an existing account already had.
//
// That every List is private is a fact about the handlers rather than about the
// schema: nothing here says who may read one, and every query that touches this
// table is scoped by `author_id`. It cascades from the Author, so an account
// deleted takes its Lists with it.
export const lists = pgTable('lists', {
  id: uuid('id').primaryKey().defaultRandom(),
  authorId: uuid('author_id').notNull().references(() => authors.id, { onDelete: 'cascade' }),
  title: text('title'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [
  uniqueIndex('one_favourites_per_author').on(table.authorId).where(sql`title is null`),
])

// What is in a List: a row per Story gathered, keyed on the pair. Putting a
// Story in a List twice therefore changes nothing — the second insert conflicts
// with the first and does nothing, rather than writing a duplicate the page
// would draw twice — and one Story sits in as many Lists as its Author gathers
// it into, which is what a row per pair buys and a column on the Story could
// not.
//
// Both ends cascade: a List deleted takes what was in it, and a Story deleted
// leaves nobody holding a List that points at a Story which is gone.
//
// `added_at` is the whole of the ordering inside a List — most recently gathered
// first, the way the Catalogue hands over the most recently published. Nothing
// here is a count, a score or a rating: there is no column one could be kept in.
export const listStories = pgTable('list_stories', {
  listId: uuid('list_id').notNull().references(() => lists.id, { onDelete: 'cascade' }),
  storyId: uuid('story_id').notNull().references(() => stories.id, { onDelete: 'cascade' }),
  addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [primaryKey({ columns: [table.listId, table.storyId] })])
