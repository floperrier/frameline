CREATE TABLE "deleted_shots" (
	"shot_id" uuid PRIMARY KEY NOT NULL,
	"scene_id" uuid NOT NULL,
	"row" jsonb NOT NULL,
	"was_cover" boolean NOT NULL,
	"taken_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deleted_shots" ADD CONSTRAINT "deleted_shots_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."scenes"("id") ON DELETE cascade ON UPDATE no action;