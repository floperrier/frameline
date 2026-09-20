import { and, eq, isNotNull } from 'drizzle-orm'
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
      language: stories.language,
      openingSceneId: stories.openingSceneId,
      stepsBack: stories.stepsBack,
      // The title card wears the same Image the shelf did, so a Reader arrives
      // where the entry they pressed said they would.
      cover: coverShotOf,
      authorId: authors.id,
      authorName: authors.name,
    })
    .from(stories)
    .innerJoin(authors, eq(stories.authorId, authors.id))
    .where(and(eq(stories.id, id), isNotNull(stories.publishedAt)))

  if (!story) throw notFound(event, 'Story')

  const { scenes, exits } = await readStoryGraph(id)

  // Where the Author put a Scene's node in the graph is none of a Reading's
  // business, so it does not leave the editor.
  //
  // Whether the Story carries a Sound anywhere, which is what makes the title
  // card a control: a Reader who presses it consents to being played something,
  // and a browser will not play into a page nobody has touched. Read off the
  // addresses the graph already carries, so no query touches the bytes.
  return {
    ...story,
    cover: coverUrl(story.cover),
    carriesSound: carriesSound({ scenes }),
    scenes: scenes.map(({ id, name, sets, shots, sound, soundOfSceneId, transcript, soundLoops }) =>
      ({ id, name, sets, shots, sound, soundOfSceneId, transcript, soundLoops })),
    exits,
  }
})
