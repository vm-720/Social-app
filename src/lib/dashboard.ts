import { and, eq, gte, inArray } from "drizzle-orm";
import type { Db } from "@/db/client";
import { analyses, comments, suggestedReplies, topics, type Platform } from "@/db/schema";
import { PROMPT_VERSION } from "./analysis/prompt";
import { emptyCounts, positiveShare, totalOf, type SentimentCounts } from "./metrics";

export const PLATFORMS: Platform[] = ["facebook", "instagram", "linkedin", "tiktok"];
export const PLATFORM_LABELS: Record<Platform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
};
export const RANGES = [7, 30, 90, 365] as const;
export const RANGE_LABELS: Record<(typeof RANGES)[number], string> = {
  7: "Last 7 days",
  30: "Last 30 days",
  90: "Last 90 days",
  365: "Last 12 months",
};
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
  postExternalId: string;
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

export function countPosts(list: ScoredComment[]): number {
  return new Set(list.map((c) => `${c.platform}:${c.postExternalId}`)).size;
}

/** External ids of comments the business has replied to, found from its own replies. */
export function repliedIds(all: ScoredComment[]): Set<string> {
  return new Set(all.filter((c) => c.isOwned && c.parentExternalId).map((c) => c.parentExternalId!));
}

export interface Overview {
  scored: number;
  posts: number;
  counts: SentimentCounts;
  /** Positive share of comments with an opinion, 0 to 100. */
  share: number | null;
  prevShare: number | null;
  openHighRisk: number;
  needsReply: number;
  replied: number;
  platforms: { platform: Platform; total: number; posts: number; counts: SentimentCounts; share: number | null }[];
}

export function buildOverview(all: ScoredComment[], filters: Filters, now = new Date()): Overview {
  const start = new Date(now.getTime() - filters.days * DAY_MS);
  const prevStart = new Date(start.getTime() - filters.days * DAY_MS);
  const inPlatform = all.filter((c) => !filters.platform || c.platform === filters.platform);
  const publicScored = inPlatform.filter((c) => !c.isOwned && c.analysis);
  const current = publicScored.filter((c) => c.postedAt >= start);
  const previous = publicScored.filter((c) => c.postedAt >= prevStart && c.postedAt < start);
  const counts = countSentiment(current);

  const replied = repliedIds(inPlatform);
  const wantReply = current.filter((c) => c.analysis!.needsReply);

  return {
    scored: totalOf(counts),
    posts: countPosts(current),
    counts,
    share: positiveShare(counts),
    prevShare: positiveShare(countSentiment(previous)),
    openHighRisk: current.filter((c) => c.analysis!.riskLevel === "high" && !c.handledAt).length,
    needsReply: wantReply.length,
    replied: wantReply.filter((c) => replied.has(c.externalId)).length,
    platforms: PLATFORMS.map((platform) => {
      const list = current.filter((c) => c.platform === platform);
      const pc = countSentiment(list);
      return { platform, total: list.length, posts: countPosts(list), counts: pc, share: positiveShare(pc) };
    }).filter((p) => p.total > 0),
  };
}

export interface TopicRow {
  topic: string;
  /** Comments tagged with the topic. */
  total: number;
  /** Distinct posts those comments were left on. */
  posts: number;
  counts: SentimentCounts;
  share: number | null;
}

export function buildTopics(list: ScoredComment[], topicNames: string[]): TopicRow[] {
  const names = [...topicNames, "Other"];
  return names
    .map((topic) => {
      const inTopic = list.filter((c) => c.analysis?.topics.includes(topic));
      const counts = countSentiment(inTopic);
      return { topic, total: inTopic.length, posts: countPosts(inTopic), counts, share: positiveShare(counts) };
    })
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);
}

/** Topics that lift sentiment up or pull it down, strongest first. Needs two opinions to count. */
export function buildDrivers(rows: TopicRow[], max = 3) {
  const sided = rows.filter((r) => r.share !== null && r.counts.positive + r.counts.negative >= 2);
  const weight = (r: TopicRow) => r.counts.positive + r.counts.negative;
  return {
    up: sided
      .filter((r) => r.share! >= 60)
      .sort((a, b) => b.share! - a.share! || weight(b) - weight(a))
      .slice(0, max),
    down: sided
      .filter((r) => r.share! <= 40)
      .sort((a, b) => a.share! - b.share! || weight(b) - weight(a))
      .slice(0, max),
  };
}

const RISK_ORDER = { high: 0, medium: 1, low: 2, none: 3 } as const;

export const INBOX_VIEWS = ["waiting", "all", "positive", "negative", "risk", "handled"] as const;
export type InboxView = (typeof INBOX_VIEWS)[number];

/**
 * Public comments for the Comments page. "waiting" is everything that asked for a reply and has
 * neither a reply from the business nor been marked handled. Risky comments come first there.
 */
export function buildInbox(
  all: ScoredComment[],
  opts: { view: InboxView; topic?: string | null; q?: string | null },
): ScoredComment[] {
  const replied = repliedIds(all);
  const q = opts.q?.trim().toLowerCase();
  const list = all.filter((c) => {
    if (c.isOwned) return false;
    const a = c.analysis;
    if (opts.topic && !a?.topics.includes(opts.topic)) return false;
    if (q && !c.text.toLowerCase().includes(q) && !(c.authorName ?? "").toLowerCase().includes(q)) return false;
    switch (opts.view) {
      case "waiting":
        return !!a?.needsReply && !c.handledAt && !replied.has(c.externalId);
      case "positive":
        return a?.sentiment === "positive";
      case "negative":
        return a?.sentiment === "negative";
      case "risk":
        return !c.handledAt && (a?.riskLevel === "high" || a?.riskLevel === "medium");
      case "handled":
        return !!c.handledAt || replied.has(c.externalId);
      default:
        return true;
    }
  });
  const riskFirst = opts.view === "waiting" || opts.view === "risk";
  return list.sort(
    (a, b) =>
      (riskFirst ? RISK_ORDER[a.analysis?.riskLevel ?? "none"] - RISK_ORDER[b.analysis?.riskLevel ?? "none"] : 0) ||
      b.postedAt.getTime() - a.postedAt.getTime(),
  );
}

export async function loadSuggestions(db: Db, commentIds: string[]): Promise<Map<string, string>> {
  if (!commentIds.length) return new Map();
  const rows = await db
    .select({ commentId: suggestedReplies.commentId, text: suggestedReplies.text })
    .from(suggestedReplies)
    .where(inArray(suggestedReplies.commentId, commentIds));
  return new Map(rows.map((r) => [r.commentId, r.text]));
}

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
