import { describe, expect, it } from "vitest";
import { buildOverview, buildRiskQueue, buildTopics, weekStart, type ScoredComment } from "@/lib/dashboard";

const now = new Date("2026-10-26T12:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000);

let i = 0;
function cm(over: Partial<ScoredComment> & { a?: Partial<NonNullable<ScoredComment["analysis"]>> | null }): ScoredComment {
  i += 1;
  const { a, ...rest } = over;
  return {
    id: `c${i}`,
    platform: "facebook",
    externalId: `e${i}`,
    parentExternalId: null,
    postUrl: null,
    authorName: "x",
    text: "t",
    postedAt: daysAgo(1),
    isOwned: false,
    handledAt: null,
    analysis:
      a === null
        ? null
        : {
            sentiment: "positive",
            sentimentScore: 0.5,
            topics: ["Travel"],
            riskLevel: "none",
            riskCategories: [],
            riskReason: null,
            needsReply: false,
            summary: "s",
            ...a,
          },
    ...rest,
  };
}

describe("buildOverview", () => {
  it("excludes own comments from sentiment and counts replies to comments that asked for one", () => {
    const asked = cm({ a: { needsReply: true, sentiment: "negative" } });
    const reply = cm({ isOwned: true, parentExternalId: asked.externalId, a: null });
    const list = [asked, reply, cm({}), cm({ postedAt: daysAgo(10), a: { sentiment: "negative" } })];
    const o = buildOverview(list, { days: 7, platform: null }, now);
    expect(o.scored).toBe(2);
    expect(o.net).toBe(0);
    expect(o.prevNet).toBe(-100);
    expect(o.needsReply).toBe(1);
    expect(o.replied).toBe(1);
  });
});

describe("buildRiskQueue", () => {
  it("puts high before medium, newest first, and hides handled items by default", () => {
    const oldHigh = cm({ postedAt: daysAgo(5), a: { riskLevel: "high" } });
    const newHigh = cm({ postedAt: daysAgo(1), a: { riskLevel: "high" } });
    const medium = cm({ postedAt: daysAgo(0), a: { riskLevel: "medium" } });
    const handled = cm({ handledAt: now, a: { riskLevel: "high" } });
    const low = cm({ a: { riskLevel: "low" } });
    expect(buildRiskQueue([medium, oldHigh, low, handled, newHigh], false).map((c) => c.id)).toEqual([
      newHigh.id,
      oldHigh.id,
      medium.id,
    ]);
    expect(buildRiskQueue([handled], true)).toHaveLength(1);
  });
});

describe("buildTopics", () => {
  it("scores each topic and sorts by volume", () => {
    const rows = buildTopics(
      [cm({ a: { topics: ["Travel", "Other"] } }), cm({ a: { topics: ["Travel"], sentiment: "negative" } })],
      ["Travel", "Insurance"],
    );
    expect(rows).toEqual([
      { topic: "Travel", total: 2, net: 0, negative: 1 },
      { topic: "Other", total: 1, net: 100, negative: 0 },
    ]);
  });
});

describe("weekStart", () => {
  it("returns the Monday of the week", () => {
    expect(weekStart(new Date("2026-10-26T12:00:00Z"))).toBe("2026-10-26");
    expect(weekStart(new Date("2026-11-01T12:00:00Z"))).toBe("2026-10-26");
  });
});
