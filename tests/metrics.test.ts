import { describe, expect, it } from "vitest";
import { leanOf, netSentiment, positiveShare, verdictFor } from "@/lib/metrics";

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

describe("positiveShare", () => {
  it("is the positive share of comments that took a side, leaving neutral and mixed out", () => {
    expect(positiveShare({ positive: 18, neutral: 5, mixed: 2, negative: 12 })).toBe(60);
  });
  it("is null when nobody took a side", () => {
    expect(positiveShare({ positive: 0, neutral: 4, mixed: 1, negative: 0 })).toBeNull();
  });
});

describe("verdictFor", () => {
  it("maps the share onto five plain-language bands", () => {
    expect(verdictFor(0)!.label).toBe("Very negative");
    expect(verdictFor(20)!.label).toBe("Very negative");
    expect(verdictFor(21)!.label).toBe("Mostly negative");
    expect(verdictFor(50)!.label).toBe("Mixed");
    expect(verdictFor(60)!.label).toBe("Mostly positive");
    expect(verdictFor(80)!.label).toBe("Very positive");
    expect(verdictFor(100)!.label).toBe("Very positive");
    expect(verdictFor(null)).toBeNull();
  });
  it("groups shares into positive, mixed and negative for colour", () => {
    expect([leanOf(75), leanOf(50), leanOf(10), leanOf(null)]).toEqual(["positive", "mixed", "negative", "none"]);
  });
});
