import { sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { useDb } from '../../../db'

/**
 * Writes a Story again, whole, under the title and in the Language its Author
 * names — see `docs/adr/0067-a-story-is-copied-whole.md`. The copy carries every
 * Scene, Shot and Exit with every column it has, the bytes of each Image and
 * Sound among them, and the Story's own Synopsis, `steps_back` and text. It is
 * unpublished and unlisted, because being read is a second act —
 * `docs/adr/0023-being-published-and-being-found-are-two-acts.md` — and it carries
 * no Comment and belongs to no List, which live in tables of their own that
 * nothing here touches.
 *
 * Every id is drawn before any row is written, one map per table, so that each
 * reference inside the copy can be laid over with the copy's own: the opening
 * Scene, the Cover, the Scene whose Sound a Scene is heard under, both ends of an
 * Exit, and the Scene or Exit a Condition asks about. The maps are materialized
 * so each new id is drawn once and read the same by every insert that names it.
 *
 * No column is listed. Each row goes in as `to_jsonb` writes it, with the new ids
 * laid over it and read back through `jsonb_populate_record`, the way a deleted
 * Shot is put back — `docs/adr/0064-a-deleted-shot-is-held-for-a-day.md` — so a
 * column added later is copied with no change here. A Scene keeps its
 * `created_at`, which is the order the bench reads the Scenes in; the Story takes
 * now, which is where the shelf puts it.
 *
 * One statement, because the neon-http driver has no transactions: a Story is
 * never left half copied. Selecting from the Author's own Stories is what proves
 * the original is theirs — one they do not own selects nothing, and nothing
 * written reads as absent.
 */
export default defineEventHandler(async (event) => {
  const author = await requireAuthor(event)
  const id = readId(event, 'Story')
  const title = await readStoryTitle(event)
  const language = await readStoryLanguage(event)

  const { rows } = await useDb().execute<{ id: string, title: string, language: string }>(sql`
    with original as (
      select * from stories where id = ${id}::uuid and author_id = ${author.id}::uuid
    ),
    scene_ids as materialized (
      select scenes.id as was, gen_random_uuid() as id
      from scenes join original on scenes.story_id = original.id
    ),
    shot_ids as materialized (
      select shots.id as was, gen_random_uuid() as id
      from shots join scene_ids on shots.scene_id = scene_ids.was
    ),
    exit_ids as materialized (
      select exits.id as was, gen_random_uuid() as id
      from exits join scene_ids on exits.from_scene_id = scene_ids.was
    ),
    story as (
      insert into stories
      select copy.*
      from original,
        jsonb_populate_record(null::stories, to_jsonb(original) || jsonb_build_object(
          'id', gen_random_uuid(),
          'title', ${title}::text,
          'language', ${language}::text,
          'opening_scene_id',
          (select scene_ids.id from scene_ids where scene_ids.was = original.opening_scene_id),
          'cover_shot_id',
          (select shot_ids.id from shot_ids where shot_ids.was = original.cover_shot_id),
          'published_at', null,
          'listed', false,
          'created_at', now()
        )) as copy
      returning id, title, language
    ),
    copied_scenes as (
      insert into scenes
      select copy.*
      from story, scenes
        join scene_ids on scene_ids.was = scenes.id
        left join scene_ids as carrier on carrier.was = scenes.sound_of_scene_id,
        jsonb_populate_record(null::scenes, to_jsonb(scenes) || jsonb_build_object(
          'id', scene_ids.id,
          'story_id', story.id,
          'sound_of_scene_id', carrier.id
        )) as copy
    ),
    copied_shots as (
      insert into shots
      select copy.*
      from shots
        join shot_ids on shot_ids.was = shots.id
        join scene_ids on scene_ids.was = shots.scene_id,
        jsonb_populate_record(null::shots, to_jsonb(shots) || jsonb_build_object(
          'id', shot_ids.id,
          'scene_id', scene_ids.id,
          'conditions', ${relinked(sql`shots.conditions`)}
        )) as copy
    ),
    copied_exits as (
      insert into exits
      select copy.*
      from exits
        join exit_ids on exit_ids.was = exits.id
        join scene_ids as leaving on leaving.was = exits.from_scene_id
        join scene_ids as landing on landing.was = exits.to_scene_id,
        jsonb_populate_record(null::exits, to_jsonb(exits) || jsonb_build_object(
          'id', exit_ids.id,
          'from_scene_id', leaving.id,
          'to_scene_id', landing.id,
          'conditions', ${relinked(sql`exits.conditions`)}
        )) as copy
    )
    select id, title, language from story
  `)

  if (!rows[0]) throw notFound(event, 'Story')

  setResponseStatus(event, 201)
  return rows[0]
})

/**
 * A row's Conditions, in their order, each asking about the copy's own Scene or
 * Exit where it asked about one of the original's. An id that names no row of
 * the original — a Scene deleted out from under the Condition — is left as it
 * is: it names nowhere in either Story, and asks the same of both.
 */
function relinked(conditions: SQL) {
  return sql`coalesce((
    select jsonb_agg(condition
      || coalesce((select jsonb_build_object('scene', scene_ids.id) from scene_ids
                   where scene_ids.was::text = lower(condition->>'scene')), '{}'::jsonb)
      || coalesce((select jsonb_build_object('exit', exit_ids.id) from exit_ids
                   where exit_ids.was::text = lower(condition->>'exit')), '{}'::jsonb)
      order by place)
    from jsonb_array_elements(${conditions}) with ordinality as listed(condition, place)
  ), '[]'::jsonb)`
}
