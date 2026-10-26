import { and, asc, eq, notExists, sql } from "drizzle-orm";
import { connectorFor } from "@/connectors";
import type { Db } from "@/db/client";
import { accounts, analyses, comments, connections, topics, type Account } from "@/db/schema";
import { analysisModel, analyzeComments } from "./analysis/claude";
import { PROMPT_VERSION } from "./analysis/prompt";
import { isOwnComment } from "./filter";

const ANALYZE_LIMIT = 500;

export interface SyncReport {
  account: string;
  fetched: number;
  inserted: number;
  owned: number;
  analyzed: number;
  errors: string[];
}

/** Pulls new comments for every connection of an account and stores them, marking the business's own. */
export async function ingestAccount(db: Db, account: Account, report: SyncReport) {
  const conns = await db.select().from(connections).where(eq(connections.accountId, account.id));
  for (const conn of conns) {
    const connector = connectorFor(conn);
    if (!connector) continue;
    try {
      const startedAt = new Date();
      const raw = await connector.fetchComments(conn, conn.lastSyncedAt);
      report.fetched += raw.length;
      const own = { externalId: conn.externalId, handle: conn.handle, extraAuthorIds: account.extraOwnAuthorIds };
      for (const r of raw) {
        const isOwned = isOwnComment(r, own);
        const inserted = await db
          .insert(comments)
          .values({ ...r, accountId: account.id, connectionId: conn.id, isOwned })
          .onConflictDoNothing()
          .returning({ id: comments.id });
        if (inserted.length) {
          report.inserted += 1;
          if (isOwned) report.owned += 1;
        }
      }
      await db.update(connections).set({ lastSyncedAt: startedAt }).where(eq(connections.id, conn.id));
    } catch (err) {
      report.errors.push(`${conn.platform} ${conn.displayName}: ${(err as Error).message}`);
    }
  }
}

/** Comments from the public that have no analysis for the current prompt version yet. */
export async function unscoredComments(db: Db, accountId: string, limit = ANALYZE_LIMIT) {
  return db
    .select({ id: comments.id, platform: comments.platform, text: comments.text })
    .from(comments)
    .where(
      and(
        eq(comments.accountId, accountId),
        eq(comments.isOwned, false),
        notExists(
          db
            .select({ one: sql`1` })
            .from(analyses)
            .where(and(eq(analyses.commentId, comments.id), eq(analyses.promptVersion, PROMPT_VERSION))),
        ),
      ),
    )
    .orderBy(asc(comments.postedAt))
    .limit(limit);
}

export async function analyzeAccount(db: Db, account: Account, report: SyncReport) {
  const pending = await unscoredComments(db, account.id);
  if (!pending.length) return;
  const topicRows = await db
    .select()
    .from(topics)
    .where(eq(topics.accountId, account.id))
    .orderBy(asc(topics.sortOrder));
  const model = analysisModel();
  const results = await analyzeComments(pending, {
    businessName: account.name,
    topics: topicRows.map((t) => ({ name: t.name, description: t.description })),
    model,
  });
  for (const [commentId, a] of results) {
    await db
      .insert(analyses)
      .values({
        commentId,
        promptVersion: PROMPT_VERSION,
        model,
        sentiment: a.sentiment,
        sentimentScore: a.sentiment_score,
        topics: a.topics,
        suggestedTopic: a.suggested_topic,
        riskLevel: a.risk_level,
        riskCategories: a.risk_categories,
        riskReason: a.risk_reason,
        needsReply: a.needs_reply,
        summary: a.summary,
      })
      .onConflictDoNothing();
    report.analyzed += 1;
  }
}

/** Fetch, filter, store and score for one account. */
export async function syncAccount(db: Db, account: Account, opts: { analyze?: boolean } = {}): Promise<SyncReport> {
  const analyze = opts.analyze ?? Boolean(process.env.ANTHROPIC_API_KEY);
  const report: SyncReport = { account: account.slug, fetched: 0, inserted: 0, owned: 0, analyzed: 0, errors: [] };
  await ingestAccount(db, account, report);
  if (analyze) {
    try {
      await analyzeAccount(db, account, report);
    } catch (err) {
      report.errors.push(`analysis: ${(err as Error).message}`);
    }
  }
  return report;
}

/** One full run over every account. Called by the cron route or `npm run sync`. */
export async function runSync(db: Db, opts: { analyze?: boolean } = {}): Promise<SyncReport[]> {
  const all = await db.select().from(accounts);
  const reports: SyncReport[] = [];
  for (const account of all) reports.push(await syncAccount(db, account, opts));
  return reports;
}
