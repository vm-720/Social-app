import { z } from "zod";

export const RISK_CATEGORIES = [
  "legal_threat",
  "safety_or_injury",
  "discrimination_or_harassment",
  "privacy_or_data",
  "regulatory",
  "fraud_or_scam",
  "crisis_or_viral",
  "employee_conduct",
  "needs_review",
] as const;

export const RISK_CATEGORY_LABELS: Record<(typeof RISK_CATEGORIES)[number], string> = {
  legal_threat: "Legal threat",
  safety_or_injury: "Safety or injury",
  discrimination_or_harassment: "Discrimination or harassment",
  privacy_or_data: "Privacy or data",
  regulatory: "Regulatory",
  fraud_or_scam: "Fraud or scam",
  crisis_or_viral: "Crisis or going viral",
  employee_conduct: "Employee conduct",
  needs_review: "Needs manual review",
};

export const commentAnalysisSchema = z.object({
  comment_id: z.string(),
  sentiment: z.enum(["positive", "neutral", "negative", "mixed"]),
  /** -1.0 (very negative) to 1.0 (very positive). Clamped after parsing. */
  sentiment_score: z.number(),
  topics: z.array(z.string()),
  suggested_topic: z.string().nullable(),
  risk_level: z.enum(["none", "low", "medium", "high"]),
  risk_categories: z.array(z.enum(RISK_CATEGORIES)),
  risk_reason: z.string().nullable(),
  needs_reply: z.boolean(),
  summary: z.string(),
});

export const batchAnalysisSchema = z.object({
  results: z.array(commentAnalysisSchema),
});

export type CommentAnalysis = z.infer<typeof commentAnalysisSchema>;
