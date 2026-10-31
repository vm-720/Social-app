"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { analyses, comments, suggestedReplies } from "@/db/schema";
import { PROMPT_VERSION } from "@/lib/analysis/prompt";
import { requireContext } from "@/lib/auth/context";
import type { ScoredComment } from "@/lib/dashboard";
import { ADJUSTMENTS, writeReply, type Adjustment } from "@/lib/replies";

export interface ReplyState {
  text: string | null;
  error: string | null;
}

/** Writes (or rewrites) the suggested reply for one comment and stores it. */
export async function suggestReply(prev: ReplyState, f: FormData): Promise<ReplyState> {
  const id = String(f.get("id") ?? "");
  const adjustRaw = String(f.get("adjust") ?? "");
  const adjust = adjustRaw in ADJUSTMENTS ? (adjustRaw as Adjustment) : null;
  const { db, current } = await requireContext();
  const [row] = await db
    .select({ c: comments, a: analyses })
    .from(comments)
    .leftJoin(analyses, and(eq(analyses.commentId, comments.id), eq(analyses.promptVersion, PROMPT_VERSION)))
    .where(and(eq(comments.id, id), eq(comments.accountId, current.account.id)));
  if (!row) return { text: prev.text, error: "That comment is no longer available." };
  if (!process.env.ANTHROPIC_API_KEY) {
    return { text: prev.text, error: "Suggested replies need ANTHROPIC_API_KEY in the server settings." };
  }
  const { c, a } = row;
  const comment: ScoredComment = {
    id: c.id,
    platform: c.platform,
    externalId: c.externalId,
    parentExternalId: c.parentExternalId,
    postExternalId: c.postExternalId,
    postUrl: c.postUrl,
    authorName: c.authorName,
    text: c.text,
    postedAt: c.postedAt,
    isOwned: c.isOwned,
    handledAt: c.handledAt,
    analysis: a
      ? {
          sentiment: a.sentiment,
          sentimentScore: a.sentimentScore,
          topics: a.topics,
          riskLevel: a.riskLevel,
          riskCategories: a.riskCategories,
          riskReason: a.riskReason,
          needsReply: a.needsReply,
          summary: a.summary,
        }
      : null,
  };
  try {
    const previous = typeof f.get("previous") === "string" ? String(f.get("previous")).slice(0, 4000) : prev.text;
    const out = await writeReply(comment, {
      businessName: current.account.name,
      voice: current.account.brandVoice,
      adjust,
      previous,
    });
    await db
      .insert(suggestedReplies)
      .values({ commentId: c.id, text: out.text, model: out.model })
      .onConflictDoUpdate({
        target: suggestedReplies.commentId,
        set: { text: out.text, model: out.model, createdAt: new Date() },
      });
    return { text: out.text, error: null };
  } catch (e) {
    return { text: prev.text, error: e instanceof Error ? e.message.slice(0, 200) : "Could not write a reply." };
  }
}

/** Marks a comment as dealt with (or reopens it). Anyone on the team can do this. */
export async function setHandled(formData: FormData) {
  const id = String(formData.get("id"));
  const handled = formData.get("handled") === "1";
  const { db, current } = await requireContext();
  await db
    .update(comments)
    .set({ handledAt: handled ? new Date() : null })
    .where(and(eq(comments.id, id), eq(comments.accountId, current.account.id)));
  revalidatePath("/dashboard", "layout");
}
