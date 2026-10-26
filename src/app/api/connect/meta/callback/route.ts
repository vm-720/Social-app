import { sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { connections } from "@/db/schema";
import { requireOwner } from "@/lib/auth/context";
import { encryptSecret } from "@/lib/crypto";
import {
  META_STATE_COOKIE,
  checkState,
  connectionsFromPages,
  exchangeCode,
  grantedPages,
  redirectUri,
} from "@/lib/meta-oauth";

/** Facebook sends the owner back here. Stores one encrypted token per granted Page and linked Instagram account. */
export async function GET(req: NextRequest) {
  const { db, current } = await requireOwner();
  const back = (status: string) => {
    const res = NextResponse.redirect(new URL(`/dashboard/settings?connect=${status}`, req.url));
    res.cookies.delete({ name: META_STATE_COOKIE, path: "/api/connect/meta" });
    return res;
  };

  const params = req.nextUrl.searchParams;
  const accountId = checkState(req.cookies.get(META_STATE_COOKIE)?.value, params.get("state"));
  // The business must be the one the flow started from, and the person must still own it.
  if (!accountId || accountId !== current.account.id) return back("expired");
  if (params.get("error")) return back("cancelled");
  const code = params.get("code");
  if (!code) return back("cancelled");

  try {
    const userToken = await exchangeCode(code, redirectUri(req.nextUrl.origin));
    const found = connectionsFromPages(await grantedPages(userToken));
    if (!found.length) return back("no_pages");
    for (const c of found) {
      await db
        .insert(connections)
        .values({
          accountId: current.account.id,
          platform: c.platform,
          externalId: c.externalId,
          displayName: c.displayName,
          handle: c.handle,
          accessToken: encryptSecret(c.token),
          tokenExpiresAt: null,
          isDemo: false,
        })
        .onConflictDoUpdate({
          target: [connections.accountId, connections.platform, connections.externalId],
          set: {
            displayName: sql`excluded.display_name`,
            handle: sql`excluded.handle`,
            accessToken: sql`excluded.access_token`,
            tokenExpiresAt: null,
            isDemo: false,
          },
        });
    }
    return back(`ok_${found.length}`);
  } catch (err) {
    console.error("Meta connect failed:", err instanceof Error ? err.message : err);
    return back("failed");
  }
}
