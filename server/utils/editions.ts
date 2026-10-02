import { sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { useDb } from '../db'

/**
 * Where a byte an edition plays is served: under the Story's own link and by the
 * digest of the bytes, so the address names what it serves and nothing an Author
 * does afterwards can change what is behind it.
 */
export function editionMediaUrl(storyId: string, digest: string) {
  return `/api/read/${storyId}/media/${digest}`
}

/** The live address each kind of held row stands in for. */
const LIVE = {
  'image': shotImageUrl,
  'shot sound': shotSoundUrl,
  'scene sound': sceneSoundUrl,
}

/**
 * Every Image and Sound of the Story a statement names `story`: the row each
 * lives in, which of the three it is, the digest its row keeps, and the bytes,
 * which nothing reads unless a statement asks for them.
 */
const CARRIED = sql`
  select shots.id, 'image' as kind, shots.image_digest as digest, shots.image as bytes
  from shots join scenes on scenes.id = shots.scene_id join story on story.id = scenes.story_id
  where shots.image is not null
  union all
  select shots.id, 'shot sound', shots.sound_digest, shots.sound
  from shots join scenes on scenes.id = shots.scene_id join story on story.id = scenes.story_id
  where shots.sound is not null
  union all
  select scenes.id, 'scene sound', scenes.sound_digest, scenes.sound
  from scenes join story on story.id = scenes.story_id
  where scenes.sound is not null
`

/** Each live address a Story's media are served at, by the digest of its bytes. */
function byAddress(rows: { id: string, kind: keyof typeof LIVE, digest: string }[]) {
  return new Map(rows.map(({ id, kind, digest }) => [LIVE[kind](id), digest]))
}

type Graph = Awaited<ReturnType<typeof readStoryGraph>>

/**
 * The work as a Reading reads it: the Scenes the bench reads narrowed to the
 * fields a Reading reads, each Image and Sound named by the address `media` gives
 * its live one, and the Exits.
 *
 * Where the Author put a Scene's node in the graph is none of a Reading's
 * business, so it does not leave the editor. What keeps it in is this list
 * naming the fields a Scene leaves by, and not `readStoryGraph` happening to
 * select nothing else: a column added there for the bench stays behind it until
 * somebody names it here, and a name added here that a Reading has no business
 * with is refused by `StoryToShow`, which is the shape the Reader's page reads
 * the answer as.
 *
 * An Edition's shape is a contract: a field named here is absent from every
 * Edition taken before it was, though the `Edition` type promises it. So the
 * change that names one either rewrites it, with its default, into every
 * `stories.edition` in the same migration (a `jsonb_set` over `scenes[*]`,
 * `shots[*]` or `exits[*]`), or has the Reading read its absence as that
 * default. Only the first keeps the bench quiet: an Edition missing a field the
 * projection now carries differs from it in every Scene, so every Scene of an
 * older Edition reads as changed until the next Publish (see *What an older
 * Edition reads as* in ADR 0070). Nulling `edition` to take it again is no way
 * out: it would publish the Author's unpublished work.
 *
 * The Cut is part of `readStoryGraph` itself now, so a Scene and a Shot
 * arrive already carrying it — nothing here resolves it, that is `cut()`'s
 * job for whoever plays the Reading. The text's arrival arrives the same way,
 * resolved by `textArrival()`, and so does how its Images move, resolved by
 * `movement()`.
 */
function forTheReading({ scenes, exits }: Graph, media: (live: string | null) => string | null):
  Pick<Edition, 'scenes' | 'exits'> {
  return {
    scenes: scenes.map(({
      id, name, sets, shots, sound, soundOfSceneId, transcript, soundLoops,
      cutAfter, cutOver, cutThrough, exitsAfter, layout,
      movementBy, movementDirection, movementOver,
      textAfter, textBy, textPace, textOver, textStays, question, questionFlag,
    }): Edition['scenes'][number] => ({
      id, name, sets, sound: media(sound), soundOfSceneId, transcript, soundLoops,
      shots: shots.map(shot => ({ ...shot, image: media(shot.image), sound: media(shot.sound) })),
      cutAfter, cutOver, cutThrough, exitsAfter, layout,
      movementBy, movementDirection, movementOver,
      textAfter, textBy, textPace, textOver, textStays, question, questionFlag,
    })),
    exits,
  }
}

/**
 * Takes an edition of a Story: holds the bytes it plays under the digest each
 * row keeps of them, copying only those not held already, reads the work as the
 * Reader's door narrows it, and writes it as what Readers read from now on. `may`
 * is the condition on the `stories` row under which this caller may take it —
 * the Author's own and readable, for a Publish; published and still without one,
 * for a first read. Nothing is held or written where it does not hold.
 *
 * Three statements, because the work is shaped here and not in SQL, so a write can
 * land between them. What makes that safe is the last one: it writes the edition
 * only where every digest it names is held, and otherwise writes nothing, and the
 * caller says so. It is refused as well when an Exit or the Opening Scene reaches
 * outside the Scenes it holds, which two queries and a write between them can
 * leave, and which an Edition would freeze. An edition never names bytes that are
 * not there — see
 * `docs/adr/0069-a-published-story-is-read-as-it-was-published.md`.
 */
export async function takeEdition(storyId: string, may: SQL) {
  // Every Image and Sound the Story carries, by the digest its row keeps, and
  // held, in one statement: nothing is hashed, no bytes leave Postgres, and only
  // the bytes of a digest not yet held are read, to be copied.
  const { rows: held } = await useDb().execute<{
    id: string
    kind: keyof typeof LIVE
    digest: string
  }>(sql`
    with story as (select id from stories where id = ${storyId}::uuid and ${may}),
    carried as (${CARRIED}),
    held as (
      insert into edition_media (story_id, digest, bytes)
      select distinct on (digest) ${storyId}::uuid, digest, bytes from carried
      where not exists (
        select 1 from edition_media
        where edition_media.story_id = ${storyId}::uuid and edition_media.digest = carried.digest)
      on conflict do nothing
    )
    select id, kind, digest from carried
  `)
  const digests = byAddress(held)

  const graph = await readStoryGraph(storyId)

  // Each live address the work carries, as the edition's own. One with no digest
  // was written after the bytes were held, so this edition is not taken.
  const named = new Set<string>()
  let unheld = false
  const media = (live: string | null) => {
    if (!live) return null
    const digest = digests.get(live)
    if (!digest) {
      unheld = true
      return null
    }
    named.add(digest)
    return editionMediaUrl(storyId, digest)
  }

  const work = forTheReading(graph, media)
  const sceneIds = new Set(graph.scenes.map(({ id }) => id))
  if (graph.exits.some(({ fromSceneId, toSceneId }) => !sceneIds.has(fromSceneId) || !sceneIds.has(toSceneId))) {
    unheld = true
  }
  if (unheld) return

  // The edition and the Story's row in one statement: the four answers the work is
  // read by come off the row it is written to, the first Publish is the one the
  // Catalogue keeps its order by, and the bytes no edition names any more are let go.
  const { rows: [taken] } = await useDb().execute<{
    id: string
    publishedAt: string
    editionAt: string
    edition: Edition
  }>(sql`
    with work as (
      select ${JSON.stringify(work)}::jsonb as json
    ),
    named as (
      select digest from jsonb_array_elements_text(${JSON.stringify([...named])}::jsonb) as digest
    ),
    written as (
      update stories set
        edition = (select json from work) || jsonb_build_object(
          'openingSceneId', opening_scene_id,
          'stepsBack', steps_back,
          'textFace', text_face,
          'textAlign', text_align),
        edition_at = now(),
        published_at = coalesce(published_at, now())
      where id = ${storyId}::uuid and ${may}
        and (opening_scene_id is null or opening_scene_id::text in (
          select scene->>'id' from work, jsonb_array_elements(work.json->'scenes') as scene))
        and not exists (
          select 1 from named where not exists (
            select 1 from edition_media
            where edition_media.story_id = ${storyId}::uuid and edition_media.digest = named.digest))
      returning id, published_at as "publishedAt", edition_at as "editionAt", edition
    ),
    let_go as (
      delete from edition_media
      where story_id in (select id from written) and digest not in (select digest from named)
    )
    select * from written
  `)

  // The two dates as every other door hands them over: a raw statement's come
  // back as Postgres spells them, and a column read through drizzle as an instant.
  return taken && {
    ...taken,
    publishedAt: new Date(taken.publishedAt).toISOString(),
    editionAt: new Date(taken.editionAt).toISOString(),
  }
}

/**
 * What differs between Readers' Edition of a Story and the Story as it is
 * written. The graph the bench has just read is projected through the function
 * that takes an Edition, each medium named by the digest its row keeps — read in
 * one statement that reads no bytes — and passed through JSON, so it is what a
 * Publish would write now rather than an object no `jsonb` ever held.
 */
export async function changesOf(
  storyId: string,
  story: Pick<Edition, 'openingSceneId' | 'stepsBack' | 'textFace' | 'textAlign'>,
  graph: Graph,
  edition: Edition,
) {
  const { rows } = await useDb().execute<{ id: string, kind: keyof typeof LIVE, digest: string }>(sql`
    with story as (select ${storyId}::uuid as id), carried as (${CARRIED})
    select id, kind, digest from carried
  `)
  const digests = byAddress(rows)
  const work = forTheReading(graph, live => live && editionMediaUrl(storyId, digests.get(live) ?? ''))
  const { openingSceneId, stepsBack, textFace, textAlign } = story

  return changesSince(edition, JSON.parse(JSON.stringify(
    { openingSceneId, stepsBack, textFace, textAlign, ...work })) as Edition)
}
