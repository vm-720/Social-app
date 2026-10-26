import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { batchAnalysisSchema, type CommentAnalysis } from "./schema";
import { buildSystemPrompt, buildUserMessage, type TopicDef } from "./prompt";

export const DEFAULT_MODEL = "claude-opus-5-5";
const BATCH_SIZE = 25;

export interface AnalysisInput {
  id: string;
  platform: string;
  text: string;
}

export interface AnalysisContext {
  businessName: string;
  topics: TopicDef[];
  model?: string;
  client?: Anthropic;
}

export function analysisModel() {
  return process.env.ANALYSIS_MODEL || DEFAULT_MODEL;
}

/** Keeps model output inside the shapes the dashboard expects. */
export function normalizeAnalysis(a: CommentAnalysis, topicNames: string[]): CommentAnalysis {
  const known = new Set([...topicNames, "Other"]);
  const topics = [...new Set(a.topics.filter((t) => known.has(t)))].slice(0, 3);
  const score = Math.max(-1, Math.min(1, Number.isFinite(a.sentiment_score) ? a.sentiment_score : 0));
  const noRisk = a.risk_level === "none";
  return {
    ...a,
    sentiment_score: score,
    topics: topics.length ? topics : ["Other"],
    risk_categories: noRisk ? [] : [...new Set(a.risk_categories)],
    risk_reason: noRisk ? null : a.risk_reason,
  };
}

/** Stored when Claude declines a comment, so it lands in the risk queue for a person to read. */
export function needsReviewPlaceholder(id: string): CommentAnalysis {
  return {
    comment_id: id,
    sentiment: "neutral",
    sentiment_score: 0,
    topics: ["Other"],
    suggested_topic: null,
    risk_level: "medium",
    risk_categories: ["needs_review"],
    risk_reason: "This comment could not be scored automatically. Please read it.",
    needs_reply: false,
    summary: "Not scored automatically",
  };
}

async function analyzeBatch(
  client: Anthropic,
  model: string,
  system: string,
  items: AnalysisInput[],
): Promise<CommentAnalysis[] | "refused"> {
  const response = await client.beta.messages.parse({
    model,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    // Re-runs a declined request on a fallback model; comments can be graphic or abusive.
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(batchAnalysisSchema) },
    system,
    messages: [{ role: "user", content: buildUserMessage(items) }],
  });
  if (response.stop_reason === "refusal") return "refused";
  if (response.stop_reason === "max_tokens" || !response.parsed_output) {
    throw new Error(`Analysis output incomplete (stop_reason=${response.stop_reason})`);
  }
  return response.parsed_output.results;
}

/**
 * Scores comments in batches. Returns one analysis per input id. A batch that is refused is
 * retried one comment at a time, so a single abusive comment does not block the rest.
 */
export async function analyzeComments(
  items: AnalysisInput[],
  ctx: AnalysisContext,
): Promise<Map<string, CommentAnalysis>> {
  const client = ctx.client ?? new Anthropic();
  const model = ctx.model ?? analysisModel();
  const system = buildSystemPrompt(ctx.businessName, ctx.topics);
  const topicNames = ctx.topics.map((t) => t.name);
  const out = new Map<string, CommentAnalysis>();

  const keep = (results: CommentAnalysis[], batch: AnalysisInput[]) => {
    const ids = new Set(batch.map((b) => b.id));
    for (const r of results) if (ids.has(r.comment_id)) out.set(r.comment_id, normalizeAnalysis(r, topicNames));
  };

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const results = await analyzeBatch(client, model, system, batch);
    if (results !== "refused") {
      keep(results, batch);
      continue;
    }
    for (const item of batch) {
      const single = await analyzeBatch(client, model, system, [item]);
      if (single === "refused") out.set(item.id, needsReviewPlaceholder(item.id));
      else keep(single, [item]);
    }
  }
  return out;
}
