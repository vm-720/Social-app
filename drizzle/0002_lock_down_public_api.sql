-- Supabase exposes the public schema through its REST API to anyone holding the anon key.
-- Turning on row level security with no policies denies that API every row; the app reaches
-- the data through its own server connection, whose role bypasses RLS.
ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "invites" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "connections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "comments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "analyses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "topics" ENABLE ROW LEVEL SECURITY;
