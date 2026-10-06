-- A clock is held to half a second at the least. A run cut sooner than that
-- changes the screen more than twice a second, which over a white Image and a
-- black one is past the three flashes WCAG 2.3.1 allows, and the doors now refuse
-- such a time — see issue #356 and
-- `docs/adr/0050-the-cut-is-made-by-the-hand-or-by-the-clock.md`. This raises
-- every time written before the floor to the floor, so a Story written before it
-- reads within the rule rather than flashing where it used to.
--
-- Nought is left alone wherever it stands: on a Shot's `cut_after` it is the
-- beat held until the press, on a Scene's `exits_after` the ways on never
-- offered, and neither is a duration. Null is *as the Scene says* or *until the
-- press*, and is left alone too.
--
-- A hand-written statement in a generated directory, as `0021` is: drizzle-kit
-- writes the schema and this changes none of it. The code before this one reads
-- a time of 500 as it reads any other, so the deploy has no window to fall into —
-- `docs/adr/0002-the-schema-moves-with-the-deploy.md`. A second run finds nothing
-- under the floor and rewrites nothing.

UPDATE "scenes" SET "cut_after" = 500 WHERE "cut_after" BETWEEN 1 AND 499;--> statement-breakpoint
UPDATE "scenes" SET "exits_after" = 500 WHERE "exits_after" BETWEEN 1 AND 499;--> statement-breakpoint
UPDATE "shots" SET "cut_after" = 500 WHERE "cut_after" BETWEEN 1 AND 499;
