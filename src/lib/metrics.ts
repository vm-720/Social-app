export interface SentimentCounts {
  positive: number;
  neutral: number;
  negative: number;
  mixed: number;
}

export function emptyCounts(): SentimentCounts {
  return { positive: 0, neutral: 0, negative: 0, mixed: 0 };
}

export function totalOf(c: SentimentCounts) {
  return c.positive + c.neutral + c.negative + c.mixed;
}

/**
 * Net Sentiment: (positive - negative) / all scored comments x 100, from -100 to 100.
 * Null when nothing has been scored, so the UI can show "no data" instead of 0.
 */
export function netSentiment(c: SentimentCounts): number | null {
  const total = totalOf(c);
  if (total === 0) return null;
  return Math.round(((c.positive - c.negative) / total) * 100);
}

/**
 * Share of comments with an opinion that are positive, from 0 to 100. Neutral and mixed comments
 * are left out, so "60" reads as "6 in 10 people who took a side spoke well of you".
 * Null when nobody took a side.
 */
export function positiveShare(c: SentimentCounts): number | null {
  const sided = c.positive + c.negative;
  if (sided === 0) return null;
  return Math.round((c.positive / sided) * 100);
}

export type Verdict = "very_negative" | "mostly_negative" | "mixed" | "mostly_positive" | "very_positive";

/** The five bands of the sentiment scale, low to high. `max` is the top of each band. */
export const VERDICTS: { id: Verdict; label: string; max: number }[] = [
  { id: "very_negative", label: "Very negative", max: 20 },
  { id: "mostly_negative", label: "Mostly negative", max: 40 },
  { id: "mixed", label: "Mixed", max: 59 },
  { id: "mostly_positive", label: "Mostly positive", max: 79 },
  { id: "very_positive", label: "Very positive", max: 100 },
];

export function verdictFor(share: number | null): (typeof VERDICTS)[number] | null {
  if (share === null) return null;
  return VERDICTS.find((v) => share <= v.max)!;
}

/** "lean" groups a verdict into the three colours the UI uses. */
export function leanOf(share: number | null): "positive" | "negative" | "mixed" | "none" {
  if (share === null) return "none";
  if (share >= 60) return "positive";
  if (share <= 40) return "negative";
  return "mixed";
}
