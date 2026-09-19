ALTER TABLE "scenes" ADD COLUMN "sound" "bytea";--> statement-breakpoint
ALTER TABLE "scenes" ADD COLUMN "sound_of_scene_id" uuid;--> statement-breakpoint
ALTER TABLE "scenes" ADD COLUMN "transcript" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "scenes" ADD COLUMN "sound_loops" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "shots" ADD COLUMN "sound" "bytea";--> statement-breakpoint
ALTER TABLE "shots" ADD COLUMN "transcript" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_sound_of_scene_id_scenes_id_fk" FOREIGN KEY ("sound_of_scene_id") REFERENCES "public"."scenes"("id") ON DELETE set null ON UPDATE no action;