"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { comments } from "@/db/schema";
import { requireContext } from "@/lib/auth/context";

export async function setHandled(formData: FormData) {
  const id = String(formData.get("id"));
  const handled = formData.get("handled") === "1";
  const { db, current } = await requireContext();
  await db
    .update(comments)
    .set({ handledAt: handled ? new Date() : null })
    .where(and(eq(comments.id, id), eq(comments.accountId, current.account.id)));
  revalidatePath("/dashboard/risk");
  revalidatePath("/dashboard");
}
