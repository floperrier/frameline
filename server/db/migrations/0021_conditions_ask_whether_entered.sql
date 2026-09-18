-- A Condition stops counting entries and asks whether a Scene has been entered.
-- A Reading stands in a Scene at most once, so the count it compared against can
-- only ever be nought or one — see `docs/adr/0048-a-scene-is-entered-once.md`,
-- whose Consequences carry the whole of the mapping below.
--
-- `at least 1` is that the Scene has been entered, and `fewer than 1` that it has
-- not. Every other test compares against a number no Reading can reach: `at least
-- 2` and up can never hold, `fewer than 2` and up always do, and a language of two
-- shapes has no way to say *never* or *always*. Those are **taken out of the
-- list** rather than rewritten into something that changes what they meant — the
-- Exit or the Shot that carried one stays, offered under whatever else it tests,
-- or offered always where that was its only test. #303 settled that, and this is
-- the deploy that carries it out; an Author's Story is never edited by hand.
--
-- A hand-written statement in a generated directory, as `0008` is: drizzle-kit
-- writes the schema and this changes none of it. What it rewrites is a jsonb
-- column the request boundary has been reading in both shapes since #305, so a
-- Story is readable on either side of this statement and the deploy has no window
-- to fall into — `docs/adr/0002-the-schema-moves-with-the-deploy.md`.
--
-- Only rows holding a counting test are touched, so a second run rewrites nothing
-- and the Places of a list are kept by aggregating in the order the array held.

UPDATE "shots" SET "conditions" = coalesce((
  SELECT jsonb_agg(asked.rewritten ORDER BY carried.place)
    FILTER (WHERE asked.rewritten IS NOT NULL)
  FROM jsonb_array_elements("shots"."conditions") WITH ORDINALITY AS carried(held, place)
  CROSS JOIN LATERAL (
    SELECT CASE
      WHEN NOT carried.held ? 'visits' THEN carried.held
      WHEN (carried.held ->> 'times')::numeric = 1
        THEN jsonb_build_object(
          'scene', carried.held -> 'scene',
          'entered', carried.held ->> 'visits' = 'at least')
    END AS rewritten
  ) AS asked
), '[]'::jsonb)
WHERE jsonb_path_exists("conditions", '$[*].visits');--> statement-breakpoint
UPDATE "exits" SET "conditions" = coalesce((
  SELECT jsonb_agg(asked.rewritten ORDER BY carried.place)
    FILTER (WHERE asked.rewritten IS NOT NULL)
  FROM jsonb_array_elements("exits"."conditions") WITH ORDINALITY AS carried(held, place)
  CROSS JOIN LATERAL (
    SELECT CASE
      WHEN NOT carried.held ? 'visits' THEN carried.held
      WHEN (carried.held ->> 'times')::numeric = 1
        THEN jsonb_build_object(
          'scene', carried.held -> 'scene',
          'entered', carried.held ->> 'visits' = 'at least')
    END AS rewritten
  ) AS asked
), '[]'::jsonb)
WHERE jsonb_path_exists("conditions", '$[*].visits');
