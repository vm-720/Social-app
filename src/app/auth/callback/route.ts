import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/auth/server";

/** Finishes email confirmation, password reset and Google sign-in links. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/dashboard";
  // Only same-site paths, so the link can't bounce users to another site.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  if (code) {
    const supabase = await createSupabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(safeNext, url.origin));
  }
  return NextResponse.redirect(new URL("/login?error=link", url.origin));
}
