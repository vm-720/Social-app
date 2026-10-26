import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const platformEnum = pgEnum("platform", ["facebook", "instagram", "linkedin", "tiktok"]);
export const sentimentEnum = pgEnum("sentiment", ["positive", "neutral", "negative", "mixed"]);
export const riskLevelEnum = pgEnum("risk_level", ["none", "low", "medium", "high"]);

/** A business using the app. Every other row hangs off an account. */
export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  /** Extra author ids (staff, agency) whose comments count as the business's own. */
  extraOwnAuthorIds: jsonb("extra_own_author_ids").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** One connected page or account on a platform. */
export const connections = pgTable(
  "connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    platform: platformEnum("platform").notNull(),
    /** Platform id of the page or account (Facebook Page id, IG user id, LinkedIn org URN, TikTok business id). */
    externalId: text("external_id").notNull(),
    displayName: text("display_name").notNull(),
    /** Username / handle, used as a second own-comment check where the platform exposes it. */
    handle: text("handle"),
    /** OAuth access token. Encrypt at rest before storing real tokens (see README). */
    accessToken: text("access_token"),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    /** "demo" connections are fed by sample data instead of a platform API. */
    isDemo: boolean("is_demo").notNull().default(false),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("connections_account_platform_external").on(t.accountId, t.platform, t.externalId)],
);

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => connections.id, { onDelete: "cascade" }),
    platform: platformEnum("platform").notNull(),
    externalId: text("external_id").notNull(),
    parentExternalId: text("parent_external_id"),
    postExternalId: text("post_external_id").notNull(),
    postUrl: text("post_url"),
    authorExternalId: text("author_external_id"),
    authorName: text("author_name"),
    text: text("text").notNull(),
    postedAt: timestamp("posted_at", { withTimezone: true }).notNull(),
    /** True when the business itself wrote it. Kept for response-rate stats, excluded from sentiment. */
    isOwned: boolean("is_owned").notNull().default(false),
    /** Set when someone marks a risk item as dealt with. */
    handledAt: timestamp("handled_at", { withTimezone: true }),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("comments_connection_external").on(t.connectionId, t.externalId),
    index("comments_account_posted").on(t.accountId, t.postedAt),
  ],
);

/** Claude's read of one comment. One row per comment per prompt version. */
export const analyses = pgTable(
  "analyses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    commentId: uuid("comment_id")
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    promptVersion: text("prompt_version").notNull(),
    model: text("model").notNull(),
    sentiment: sentimentEnum("sentiment").notNull(),
    sentimentScore: real("sentiment_score").notNull(),
    topics: jsonb("topics").$type<string[]>().notNull(),
    suggestedTopic: text("suggested_topic"),
    riskLevel: riskLevelEnum("risk_level").notNull(),
    riskCategories: jsonb("risk_categories").$type<string[]>().notNull(),
    riskReason: text("risk_reason"),
    needsReply: boolean("needs_reply").notNull(),
    summary: text("summary").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("analyses_comment_prompt").on(t.commentId, t.promptVersion)],
);

/** Each account's own topic list, so topic views stay stable over time. */
export const topics = pgTable(
  "topics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [uniqueIndex("topics_account_name").on(t.accountId, t.name)],
);

export type Account = typeof accounts.$inferSelect;
export type Connection = typeof connections.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type Analysis = typeof analyses.$inferSelect;
export type Topic = typeof topics.$inferSelect;
export type Platform = (typeof platformEnum.enumValues)[number];
