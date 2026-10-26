import { and, eq, gte } from "drizzle-orm";
import type { Db } from "@/db/client";
import { analyses, comments, topics, type Platform } from "@/db/schema";
import { PROMPT_VERSION } from "./analysis/prompt";
import { emptyCounts, netSentiment, totalOf, type SentimentCounts } from "./metrics";

export const PLATFORMS: Platform[] = ["facebook", "instagram", "linkedin", "tiktok"];
export const PLATFORM_LABELS: Record<Platform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
};
export const RANGES = [7, 30, 90] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface Filters {
  days: number;
  platform: Platform | null;
}

export function parseFilters(params: Record<string, string | string[] | undefined>): Filters {
  const days = Number(params.days);
  const platform = params.platform as Platform | undefined;
  return {
    days: (RANGES as readonly number[]).includes(days) ? days : 30,
    platform: platform && PLATFORMS.includes(platform) ? platform : null,
  };
}

export interface ScoredComment {
  id: string;
  platform: Platform;
  externalId: string;
  parentExternalId: string | null;
  postUrl: string | null;
  authorName: string | null;
  text: string;
  postedAt: Date;
  isOwned: boolean;
  handledAt: Date | null;
  analysis: {
    sentiment: keyof SentimentCounts;
    sentimentScore: number;
    topics: string[];
    riskLevel: "none" | "low" | "medium" | "high";
    riskCategories: string[];
    riskReason: string | null;
    needsReply: boolean;
    summary: string;
  } | null;
}

/** All comments (own replies included) for the account in the window, with their current analysis. */
export async function loadComments(db: Db, accountId: string, since: Date): Promise<ScoredComment[]> {
  const rows = await db
    .select({ c: comments, a: analyses })
    .from(comments)
    .leftJoin(analyses, and(eq(analyses.commentId, comments.id), eq(analyses.promptVersion, PROMPT_VERSION)))
    .where(and(eq(comments.accountId, accountId), gte(comments.postedAt, since)));
  return rows.map(({ c, a }) => ({
    id: c.id,
    platform: c.platform,
    externalId: c.externalId,
    parentExternalId: c.parentExternalId,
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
  }));
}

export async function loadTopicNames(db: Db, accountId: string) {
  const rows = await db.select().from(topics).where(eq(topics.accountId, accountId)).orderBy(topics.sortOrder);
  return rows.map((t) => t.name);
}

export function countSentiment(list: ScoredComment[]): SentimentCounts {
  const counts = emptyCounts();
  for (const c of list) if (c.analysis) counts[c.analysis.sentiment] += 1;
  return counts;
}

/** Monday of the week containing `d`, as YYYY-MM-DD (UTC). */
export function weekStart(d: Date): string {
  const day = (d.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day)).toISOString().slice(0, 10);
}

export interface Overview {
  scored: number;
  counts: SentimentCounts;
  net: number | null;
  prevNet: number | null;
  openHighRisk: number;
  needsReply: number;
  replied: number;
  trend: { week: string; values: Partial<Record<Platform, number | null>> }[];
  mix: { platform: Platform; counts: SentimentCounts }[];
}

export function buildOverview(all: ScoredComment[], filters: Filters, now = new Date()): Overview {
  const start = new Date(now.getTime() - filters.days * DAY_MS);
  const prevStart = new Date(start.getTime() - filters.days * DAY_MS);
  const inPlatform = all.filter((c) => !filters.platform || c.platform === filters.platform);
  const publicScored = inPlatform.filter((c) => !c.isOwned && c.analysis);
  const current = publicScored.filter((c) => c.postedAt >= start);
  const previous = publicScored.filter((c) => c.postedAt >= prevStart && c.postedAt < start);
  const counts = countSentiment(current);

  const ownReplyParents = new Set(inPlatform.filter((c) => c.isOwned && c.parentExternalId).map((c) => c.parentExternalId));
  const wantReply = current.filter((c) => c.analysis!.needsReply);

  const weeks = new Map<string, Map<Platform, ScoredComment[]>>();
  for (const c of current) {
    const w = weekStart(c.postedAt);
    if (!weeks.has(w)) weeks.set(w, new Map());
    const byPlatform = weeks.get(w)!;
    byPlatform.set(c.platform, [...(byPlatform.get(c.platform) ?? []), c]);
  }
  const trend = [...weeks.keys()].sort().map((week) => {
    const values: Partial<Record<Platform, number | null>> = {};
    for (const p of PLATFORMS) {
      const list = weeks.get(week)!.get(p);
      if (list) values[p] = netSentiment(countSentiment(list));
    }
    return { week, values };
  });

  return {
    scored: totalOf(counts),
    counts,
    net: netSentiment(counts),
    prevNet: netSentiment(countSentiment(previous)),
    openHighRisk: current.filter((c) => c.analysis!.riskLevel === "high" && !c.handledAt).length,
    needsReply: wantReply.length,
    replied: wantReply.filter((c) => ownReplyParents.has(c.externalId)).length,
    trend,
    mix: PLATFORMS.map((platform) => ({
      platform,
      counts: countSentiment(current.filter((c) => c.platform === platform)),
    })).filter((m) => totalOf(m.counts) > 0),
  };
}

export interface TopicRow {
  topic: string;
  total: number;
  net: number | null;
  negative: number;
}

export function buildTopics(list: ScoredComment[], topicNames: string[]): TopicRow[] {
  const names = [...topicNames, "Other"];
  return names
    .map((topic) => {
      const inTopic = list.filter((c) => c.analysis?.topics.includes(topic));
      const counts = countSentiment(inTopic);
      return { topic, total: inTopic.length, net: netSentiment(counts), negative: counts.negative };
    })
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);
}

const RISK_ORDER = { high: 0, medium: 1, low: 2, none: 3 } as const;

export function buildRiskQueue(list: ScoredComment[], includeHandled: boolean): ScoredComment[] {
  return list
    .filter((c) => c.analysis && (c.analysis.riskLevel === "high" || c.analysis.riskLevel === "medium"))
    .filter((c) => includeHandled || !c.handledAt)
    .sort(
      (a, b) =>
        RISK_ORDER[a.analysis!.riskLevel] - RISK_ORDER[b.analysis!.riskLevel] ||
        b.postedAt.getTime() - a.postedAt.getTime(),
    );
}

export function windowStart(filters: Filters, now = new Date()) {
  return new Date(now.getTime() - filters.days * DAY_MS);
}
