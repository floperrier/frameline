CREATE TABLE "reading_counts" (
	"story_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"count" integer NOT NULL,
	CONSTRAINT "reading_counts_story_id_kind_subject_id_pk" PRIMARY KEY("story_id","kind","subject_id")
);
--> statement-breakpoint
ALTER TABLE "reading_counts" ADD CONSTRAINT "reading_counts_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;