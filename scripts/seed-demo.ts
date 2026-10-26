// Creates the AAA WCNY account with sample comments on all four platforms.
//   npm run seed:demo                        sample scores written by hand (no API key needed)
//   npm run seed:demo -- --score-with-claude  scores the sample comments with Claude instead
import "dotenv/config";
import { and, eq, inArray } from "drizzle-orm";
import { DEMO_ACCOUNT, DEMO_COMMENTS, DEMO_PAGES, DEMO_TOPICS } from "../src/connectors/demo-data";
import { getDb, runMigrations } from "../src/db/client";
import { accounts, analyses, comments, connections, topics, type Platform } from "../src/db/schema";
import { PROMPT_VERSION } from "../src/lib/analysis/prompt";
import { analyzeAccount, ingestAccount, type SyncReport } from "../src/lib/sync";

const withClaude = process.argv.includes("--score-with-claude");

await runMigrations();
const db = getDb();

await db.insert(accounts).values(DEMO_ACCOUNT).onConflictDoNothing();
const [account] = await db.select().from(accounts).where(eq(accounts.slug, DEMO_ACCOUNT.slug));

await db
  .insert(topics)
  .values(DEMO_TOPICS.map((t, i) => ({ ...t, accountId: account.id, sortOrder: i })))
  .onConflictDoNothing();

for (const [platform, page] of Object.entries(DEMO_PAGES) as [Platform, (typeof DEMO_PAGES)[Platform]][]) {
  await db
    .insert(connections)
    .values({ accountId: account.id, platform, isDemo: true, ...page })
    .onConflictDoNothing();
}

const report: SyncReport = { account: account.slug, fetched: 0, inserted: 0, owned: 0, analyzed: 0, errors: [] };
await ingestAccount(db, account, report);

if (withClaude) {
  await analyzeAccount(db, account, report);
} else {
  const rows = await db
    .select({ id: comments.id, externalId: comments.externalId })
    .from(comments)
    .where(and(eq(comments.accountId, account.id), inArray(comments.externalId, DEMO_COMMENTS.map((d) => d.id))));
  const byExternal = new Map(rows.map((r) => [r.externalId, r.id]));
  for (const d of DEMO_COMMENTS) {
    const commentId = byExternal.get(d.id);
    if (!d.score || !commentId) continue;
    const a = d.score;
    const inserted = await db
      .insert(analyses)
      .values({
        commentId,
        promptVersion: PROMPT_VERSION,
        model: "sample-fixture",
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
      .onConflictDoNothing()
      .returning({ id: analyses.id });
    report.analyzed += inserted.length;
  }
}

console.table([{ ...report, errors: report.errors.join("; ") }]);
process.exit(report.errors.length ? 1 : 0);
