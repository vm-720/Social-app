import { describe, expect, it } from "vitest";
import {
  buildDrivers,
  buildInbox,
  buildOverview,
  buildRiskQueue,
  buildTopics,
  type ScoredComment,
} from "@/lib/dashboard";

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
    postExternalId: "p1",
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
    expect(o.share).toBe(50);
    expect(o.prevShare).toBe(0);
    expect(o.posts).toBe(1);
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
  it("counts comments, distinct posts and the positive share per topic, sorted by volume", () => {
    const rows = buildTopics(
      [
        cm({ a: { topics: ["Travel", "Other"] } }),
        cm({ postExternalId: "p2", a: { topics: ["Travel"], sentiment: "negative" } }),
        cm({ postExternalId: "p2", a: { topics: ["Travel"], sentiment: "neutral" } }),
      ],
      ["Travel", "Insurance"],
    );
    expect(rows.map((r) => [r.topic, r.total, r.posts, r.share])).toEqual([
      ["Travel", 3, 2, 50],
      ["Other", 1, 1, 100],
    ]);
  });
});

describe("buildDrivers", () => {
  it("splits topics into lifting and pulling, ignoring topics with fewer than two opinions", () => {
    const rows = buildTopics(
      [
        cm({ a: { topics: ["Travel"] } }),
        cm({ a: { topics: ["Travel"] } }),
        cm({ a: { topics: ["Insurance"], sentiment: "negative" } }),
        cm({ a: { topics: ["Insurance"], sentiment: "negative" } }),
        cm({ a: { topics: ["Discounts"] } }),
      ],
      ["Travel", "Insurance", "Discounts"],
    );
    const d = buildDrivers(rows);
    expect(d.up.map((r) => r.topic)).toEqual(["Travel"]);
    expect(d.down.map((r) => r.topic)).toEqual(["Insurance"]);
  });
});

describe("buildInbox", () => {
  it("shows comments waiting for a reply, risky first, and moves replied or handled ones out", () => {
    const plain = cm({ postedAt: daysAgo(0), a: { needsReply: true } });
    const risky = cm({ postedAt: daysAgo(3), a: { needsReply: true, riskLevel: "high" } });
    const answered = cm({ a: { needsReply: true } });
    const reply = cm({ isOwned: true, parentExternalId: answered.externalId, a: null });
    const handled = cm({ handledAt: now, a: { needsReply: true } });
    const quiet = cm({ a: { needsReply: false } });
    const all = [plain, risky, answered, reply, handled, quiet];
    expect(buildInbox(all, { view: "waiting" }).map((c) => c.id)).toEqual([risky.id, plain.id]);
    expect(buildInbox(all, { view: "handled" }).map((c) => c.id).sort()).toEqual([answered.id, handled.id].sort());
    expect(buildInbox(all, { view: "all" })).toHaveLength(5);
  });

  it("filters by topic and search text", () => {
    const a = cm({ text: "Great tow driver", a: { topics: ["Roadside"] } });
    const b = cm({ text: "Slow tow", a: { topics: ["Other"] } });
    expect(buildInbox([a, b], { view: "all", topic: "Roadside" }).map((c) => c.id)).toEqual([a.id]);
    expect(buildInbox([a, b], { view: "all", q: "slow" }).map((c) => c.id)).toEqual([b.id]);
  });
});
