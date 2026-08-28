ALTER TABLE "cuts" RENAME TO "exits";--> statement-breakpoint
ALTER TABLE "exits" DROP CONSTRAINT "cuts_from_scene_id_scenes_id_fk";
--> statement-breakpoint
ALTER TABLE "exits" DROP CONSTRAINT "cuts_to_scene_id_scenes_id_fk";
--> statement-breakpoint
ALTER TABLE "exits" ADD CONSTRAINT "exits_from_scene_id_scenes_id_fk" FOREIGN KEY ("from_scene_id") REFERENCES "public"."scenes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exits" ADD CONSTRAINT "exits_to_scene_id_scenes_id_fk" FOREIGN KEY ("to_scene_id") REFERENCES "public"."scenes"("id") ON DELETE cascade ON UPDATE no action;