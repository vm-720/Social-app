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
