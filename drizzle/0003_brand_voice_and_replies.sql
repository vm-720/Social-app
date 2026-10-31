CREATE TABLE "suggested_replies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"comment_id" uuid NOT NULL,
	"text" text NOT NULL,
	"model" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "brand_voice" jsonb;--> statement-breakpoint
ALTER TABLE "suggested_replies" ADD CONSTRAINT "suggested_replies_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "suggested_replies_comment" ON "suggested_replies" USING btree ("comment_id");--> statement-breakpoint
-- Same lockdown as 0002: the app reads this table through its own server connection only.
ALTER TABLE "suggested_replies" ENABLE ROW LEVEL SECURITY;