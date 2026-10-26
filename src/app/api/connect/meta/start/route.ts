import { NextResponse, type NextRequest } from "next/server";
import { requireOwner } from "@/lib/auth/context";
import { META_STATE_COOKIE, authorizeUrl, metaConfigured, newState, redirectUri } from "@/lib/meta-oauth";

/** Sends an owner to Facebook to grant access to their Pages and linked Instagram accounts. */
export async function GET(req: NextRequest) {
  const { current } = await requireOwner();
  if (!metaConfigured()) return NextResponse.redirect(new URL("/dashboard/settings?connect=not_configured", req.url));
  const { nonce, cookie } = newState(current.account.id);
  const res = NextResponse.redirect(authorizeUrl(nonce, redirectUri(req.nextUrl.origin)));
  res.cookies.set(META_STATE_COOKIE, cookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/connect/meta",
    maxAge: 600,
  });
  return res;
}
