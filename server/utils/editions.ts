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
 * Takes an edition of a Story: holds the bytes it plays, reads the work as the
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
  // Every Image and Sound the Story carries, digested once and held, in one
  // statement: no bytes leave Postgres, and bytes already held are left alone.
  const { rows: held } = await useDb().execute<{
    id: string
    kind: keyof typeof LIVE
    digest: string
  }>(sql`
    with story as (select id from stories where id = ${storyId}::uuid and ${may}),
    carried as (
      select shots.id, 'image' as kind, shots.image as bytes
      from shots join scenes on scenes.id = shots.scene_id join story on story.id = scenes.story_id
      where shots.image is not null
      union all
      select shots.id, 'shot sound', shots.sound
      from shots join scenes on scenes.id = shots.scene_id join story on story.id = scenes.story_id
      where shots.sound is not null
      union all
      select scenes.id, 'scene sound', scenes.sound
      from scenes join story on story.id = scenes.story_id
      where scenes.sound is not null
    ),
    digested as materialized (
      select id, kind, bytes, encode(sha256(bytes), 'hex') as digest from carried
    ),
    held as (
      insert into edition_media (story_id, digest, bytes)
      select distinct on (digest) ${storyId}::uuid, digest, bytes from digested
      on conflict do nothing
    )
    select id, kind, digest from digested
  `)
  const digests = new Map(held.map(({ id, kind, digest }) => [LIVE[kind](id), digest]))

  const { scenes, exits } = await readStoryGraph(storyId)

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

  // Where the Author put a Scene's node in the graph is none of a Reading's
  // business, so it does not leave the editor. What keeps it in is this list
  // naming the fields a Scene leaves by, and not `readStoryGraph` happening to
  // select nothing else: a column added there for the bench stays behind it until
  // somebody names it here, and a name added here that a Reading has no business
  // with is refused by `StoryToShow`, which is the shape the Reader's page reads
  // the answer as.
  //
  // An Edition's shape is a contract: a field named here is absent from every
  // Edition taken before it was, though the `Edition` type promises it. So the
  // change that names one either rewrites it, with its default, into every
  // `stories.edition` in the same migration (a `jsonb_set` over `scenes[*]`,
  // `shots[*]` or `exits[*]`), or has the Reading read its absence as that
  // default. Nulling `edition` to take it again is no way out: it would publish
  // the Author's unpublished work.
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
    textAfter, textBy, textPace, textOver, textStays, question, questionFlag,
  }): Edition['scenes'][number] => ({
    id, name, sets, sound: media(sound), soundOfSceneId, transcript, soundLoops,
    shots: shots.map(shot => ({ ...shot, image: media(shot.image), sound: media(shot.sound) })),
    cutAfter, cutOver, cutThrough, exitsAfter, layout,
    movementBy, movementDirection, movementOver,
    textAfter, textBy, textPace, textOver, textStays, question, questionFlag,
  }))
  const sceneIds = new Set(scenes.map(({ id }) => id))
  if (exits.some(({ fromSceneId, toSceneId }) => !sceneIds.has(fromSceneId) || !sceneIds.has(toSceneId))) {
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
      select ${JSON.stringify({ scenes: forTheReading, exits })}::jsonb as json
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
