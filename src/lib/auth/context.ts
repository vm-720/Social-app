import { and, asc, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb, type Db } from "@/db/client";
import { accounts, invites, memberships, type Account, type Role } from "@/db/schema";
import type { SessionUser } from "./config";
import { getSessionUser } from "./server";

export const ACCOUNT_COOKIE = "account_id";

export interface AccountAccess {
  account: Account;
  role: Role;
}

export interface AppContext {
  db: Db;
  user: SessionUser;
  accounts: AccountAccess[];
  current: AccountAccess;
}

/** Turns any invites for this verified email into memberships. */
export async function acceptInvites(db: Db, user: SessionUser) {
  const pending = await db.select().from(invites).where(eq(invites.email, user.email));
  for (const inv of pending) {
    await db
      .insert(memberships)
      .values({ accountId: inv.accountId, userId: user.id, email: user.email, role: inv.role })
      .onConflictDoNothing();
    await db.delete(invites).where(eq(invites.id, inv.id));
  }
}

export async function listAccess(db: Db, userId: string): Promise<AccountAccess[]> {
  const rows = await db
    .select({ account: accounts, role: memberships.role })
    .from(memberships)
    .innerJoin(accounts, eq(accounts.id, memberships.accountId))
    .where(eq(memberships.userId, userId))
    .orderBy(asc(accounts.name));
  return rows;
}

/** Picks the account named in the cookie when the user belongs to it, else their first. */
export function chooseAccount(access: AccountAccess[], preferredId: string | undefined): AccountAccess | null {
  return access.find((a) => a.account.id === preferredId) ?? access[0] ?? null;
}

/**
 * Everything a dashboard page or action needs. Sends visitors without a session to /login and
 * signed-in users with no business yet to /onboarding.
 */
export async function requireContext(): Promise<AppContext> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const db = getDb();
  await acceptInvites(db, user);
  const access = await listAccess(db, user.id);
  const current = chooseAccount(access, (await cookies()).get(ACCOUNT_COOKIE)?.value);
  if (!current) redirect("/onboarding");
  return { db, user, accounts: access, current };
}

export async function requireOwner(): Promise<AppContext> {
  const ctx = await requireContext();
  if (ctx.current.role !== "owner") throw new Error("Only an owner can change this");
  return ctx;
}

export async function isMember(db: Db, userId: string, accountId: string) {
  const rows = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(and(eq(memberships.userId, userId), eq(memberships.accountId, accountId)));
  return rows.length > 0;
}
