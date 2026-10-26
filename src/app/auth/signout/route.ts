import { NextResponse } from "next/server";
import { authEnabled } from "@/lib/auth/config";
import { createSupabaseServer } from "@/lib/auth/server";

export async function POST(req: Request) {
  if (authEnabled()) await (await createSupabaseServer()).auth.signOut();
  return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
}
