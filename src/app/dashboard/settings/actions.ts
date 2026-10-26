"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { accounts, invites, memberships, topics } from "@/db/schema";
import { requireOwner } from "@/lib/auth/context";

const done = () => revalidatePath("/dashboard/settings");
const text = (f: FormData, k: string, max: number) => String(f.get(k) ?? "").trim().slice(0, max);

export async function renameBusiness(f: FormData) {
  const { db, current } = await requireOwner();
  const name = text(f, "name", 120);
  if (name) await db.update(accounts).set({ name }).where(eq(accounts.id, current.account.id));
  done();
}

export async function addTopic(f: FormData) {
  const { db, current } = await requireOwner();
  const name = text(f, "name", 60);
  if (!name || name.toLowerCase() === "other") return;
  const existing = await db.select().from(topics).where(eq(topics.accountId, current.account.id));
  await db
    .insert(topics)
    .values({ accountId: current.account.id, name, description: text(f, "description", 200) || null, sortOrder: existing.length })
    .onConflictDoNothing();
  done();
}

export async function removeTopic(f: FormData) {
  const { db, current } = await requireOwner();
  await db.delete(topics).where(and(eq(topics.id, text(f, "id", 64)), eq(topics.accountId, current.account.id)));
  done();
}

export async function saveBrandAccounts(f: FormData) {
  const { db, current } = await requireOwner();
  const ids = [
    ...new Set(
      text(f, "ids", 5000)
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ].slice(0, 100);
  await db.update(accounts).set({ extraOwnAuthorIds: ids }).where(eq(accounts.id, current.account.id));
  done();
}

export async function inviteMember(f: FormData) {
  const { db, current, user } = await requireOwner();
  const email = text(f, "email", 254).toLowerCase();
  const role = f.get("role") === "owner" ? "owner" : "member";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
  const already = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.accountId, current.account.id), eq(memberships.email, email)));
  if (!already.length) {
    await db
      .insert(invites)
      .values({ accountId: current.account.id, email, role, invitedBy: user.id })
      .onConflictDoNothing();
  }
  done();
}

export async function revokeInvite(f: FormData) {
  const { db, current } = await requireOwner();
  await db.delete(invites).where(and(eq(invites.id, text(f, "id", 64)), eq(invites.accountId, current.account.id)));
  done();
}

export async function removeMember(f: FormData) {
  const { db, current } = await requireOwner();
  const id = text(f, "id", 64);
  const [target] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.id, id), eq(memberships.accountId, current.account.id)));
  if (!target) return;
  if (target.role === "owner") {
    // Never leave a business without an owner.
    const otherOwners = await db
      .select()
      .from(memberships)
      .where(
        and(eq(memberships.accountId, current.account.id), eq(memberships.role, "owner"), ne(memberships.id, id)),
      );
    if (!otherOwners.length) return;
  }
  await db.delete(memberships).where(eq(memberships.id, id));
  done();
}
