"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { comments } from "@/db/schema";
import { getCurrentAccount } from "@/lib/dashboard";

export async function setHandled(formData: FormData) {
  const id = String(formData.get("id"));
  const handled = formData.get("handled") === "1";
  const db = getDb();
  const account = await getCurrentAccount(db);
  if (!account) return;
  await db
    .update(comments)
    .set({ handledAt: handled ? new Date() : null })
    .where(and(eq(comments.id, id), eq(comments.accountId, account.id)));
  revalidatePath("/dashboard/risk");
  revalidatePath("/dashboard");
}
