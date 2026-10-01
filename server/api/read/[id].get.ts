import { and, eq, isNotNull, sql } from 'drizzle-orm'
import { authors, stories } from '../../db/schema'
import { useDb } from '../../db'

/**
 * A published Story as a Reader receives it, with no account and no session.
 * Whether it is published is part of the lookup rather than a check after it, so
 * an unpublished Story cannot be answered by mistake: it gets the same not-found
 * as an id nobody ever wrote.
 *
 * A Reading is not stored anywhere. The Reader is handed the Story and keeps
 * their own Path in it, which is why two Readers of one Story can never
 * share what they have accumulated — there is nothing here to share.
 *
 * It is signed, as an entry on a shelf is: the Author's id and Name, so the page
 * a Reader finishes on can lead to whoever wrote what they have just read. The
 * join is an inner one because a Story is owned by one Author and the column
 * says so; the Name is what may be absent, and the page draws no byline where
 * there is none. The email is not selected.
 */
export default defineEventHandler(async (event) => {
  const id = readId(event, 'Story')

  const [story] = await useDb()
    .select({
      id: stories.id,
      title: stories.title,
      // Not drawn on the page: it is what the link is presented by where it is
      // pasted, which is where the Story meets somebody who has not read it.
      synopsis: stories.synopsis,
      language: stories.language,
      openingSceneId: stories.openingSceneId,
      stepsBack: stories.stepsBack,
      textFace: stories.textFace,
      textAlign: stories.textAlign,
      // The title card wears the same Image the shelf did, so a Reader arrives
      // where the entry they pressed said they would.
      coverShotId: coverShotOf,
      cropX: coverShot.cropX,
      cropY: coverShot.cropY,
      authorId: authors.id,
      authorName: authors.name,
    })
    .from(stories)
    .innerJoin(authors, eq(stories.authorId, authors.id))
    .leftJoin(coverShot, sql`${coverShot.id} = ${coverShotOf}`)
    .where(and(eq(stories.id, id), isNotNull(stories.publishedAt)))

  if (!story) throw notFound(event, 'Story')

  const { scenes, exits } = await readStoryGraph(id)

  // Where the Author put a Scene's node in the graph is none of a Reading's
  // business, so it does not leave the editor. `readStoryGraph` is read by both
  // doors, so what keeps it in is this door naming the fields a Scene leaves by,
  // and not that query happening to select nothing else: a column added there
  // for the bench stays behind it until somebody names it here, and a name added
  // here that a Reading has no business with is refused by `StoryToShow`, which
  // is the shape the Reader's page reads the answer as.
  //
  // The Cut is part of `readStoryGraph` itself now, so a Scene and a Shot
  // arrive already carrying it — nothing here resolves it, that is `cut()`'s
  // job for whoever plays the Reading. The text's arrival arrives the same way,
  // resolved by `textArrival()`, and so does how its Images move, resolved by
  // `movement()`.
  const forTheReading = scenes.map(({
    id, name, sets, shots, sound, soundOfSceneId, transcript, soundLoops,
    cutAfter, cutOver, cutThrough, exitsAfter, layout,
    movementBy, movementDirection, movementOver,
    textAfter, textBy, textPace, textOver, textStays,
  }): StoryToShow['scenes'][number] => ({
    id, name, sets, shots, sound, soundOfSceneId, transcript, soundLoops,
    cutAfter, cutOver, cutThrough, exitsAfter, layout,
    movementBy, movementDirection, movementOver,
    textAfter, textBy, textPace, textOver, textStays,
  }))

  // The Cover leaves as one object, the Image and its point together, so the
  // columns it was read from are not sent beside it.
  const { coverShotId, cropX, cropY, ...rest } = story

  // Whether the Story carries a Sound anywhere, which is what makes the title
  // card a control: a Reader who presses it consents to being played something,
  // and a browser will not play into a page nobody has touched. Read off the
  // addresses the graph already carries, so no query touches the bytes.
  return {
    ...rest,
    cover: coverFor({ coverShotId, cropX, cropY }),
    carriesSound: carriesSound({ scenes: forTheReading }),
    scenes: forTheReading,
    exits,
  }
})
