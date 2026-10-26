import { NextResponse } from "next/server";
import { getDb, runMigrations } from "@/db/client";
import { runSync } from "@/lib/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Hourly sync. Vercel Cron sends "Authorization: Bearer $CRON_SECRET". */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await runMigrations();
  const reports = await runSync(getDb());
  return NextResponse.json({ reports });
}
