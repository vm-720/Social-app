import { describe, expect, it } from "vitest";
import { netSentiment } from "@/lib/metrics";

describe("netSentiment", () => {
  it("is positive minus negative over all scored comments", () => {
    expect(netSentiment({ positive: 6, neutral: 2, mixed: 0, negative: 2 })).toBe(40);
  });
  it("runs from -100 to 100", () => {
    expect(netSentiment({ positive: 0, neutral: 0, mixed: 0, negative: 3 })).toBe(-100);
    expect(netSentiment({ positive: 3, neutral: 0, mixed: 0, negative: 0 })).toBe(100);
  });
  it("is null with nothing scored", () => {
    expect(netSentiment({ positive: 0, neutral: 0, mixed: 0, negative: 0 })).toBeNull();
  });
});
