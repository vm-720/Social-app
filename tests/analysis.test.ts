import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { analyzeComments, normalizeAnalysis } from "@/lib/analysis/claude";
import type { CommentAnalysis } from "@/lib/analysis/schema";

function result(id: string, over: Partial<CommentAnalysis> = {}): CommentAnalysis {
  return {
    comment_id: id,
    sentiment: "positive",
    sentiment_score: 0.8,
    topics: ["Travel"],
    suggested_topic: null,
    risk_level: "none",
    risk_categories: [],
    risk_reason: null,
    needs_reply: false,
    summary: "ok",
    ...over,
  };
}

function fakeClient(parse: (body: { messages: { content: string }[] }) => unknown) {
  return { beta: { messages: { parse: vi.fn(async (body) => parse(body)) } } } as unknown as Anthropic & {
    beta: { messages: { parse: ReturnType<typeof vi.fn> } };
  };
}

const ctx = { businessName: "Test Co", topics: [{ name: "Travel", description: null }] };

describe("normalizeAnalysis", () => {
  it("clamps scores, drops unknown topics and clears risk fields when risk is none", () => {
    const n = normalizeAnalysis(
      result("1", { sentiment_score: 3, topics: ["Made up"], risk_categories: ["legal_threat"], risk_reason: "x" }),
      ["Travel"],
    );
    expect(n.sentiment_score).toBe(1);
    expect(n.topics).toEqual(["Other"]);
    expect(n.risk_categories).toEqual([]);
    expect(n.risk_reason).toBeNull();
  });
});

describe("analyzeComments", () => {
  it("returns one result per comment and ignores ids it did not send", async () => {
    const client = fakeClient(() => ({
      stop_reason: "end_turn",
      parsed_output: { results: [result("a"), result("b"), result("stray")] },
    }));
    const out = await analyzeComments(
      [
        { id: "a", platform: "facebook", text: "great" },
        { id: "b", platform: "facebook", text: "nice" },
      ],
      { ...ctx, client },
    );
    expect([...out.keys()].sort()).toEqual(["a", "b"]);
  });

  it("retries a refused batch one by one and flags the comment that is still refused", async () => {
    const client = fakeClient((body) => {
      const sent = JSON.parse(body.messages[0].content).comments as { id: string }[];
      if (sent.length > 1 || sent[0].id === "bad") return { stop_reason: "refusal", parsed_output: null };
      return { stop_reason: "end_turn", parsed_output: { results: [result(sent[0].id)] } };
    });
    const out = await analyzeComments(
      [
        { id: "good", platform: "tiktok", text: "fine" },
        { id: "bad", platform: "tiktok", text: "abusive" },
      ],
      { ...ctx, client },
    );
    expect(out.get("good")?.sentiment).toBe("positive");
    expect(out.get("bad")?.risk_categories).toEqual(["needs_review"]);
    expect(client.beta.messages.parse).toHaveBeenCalledTimes(3);
  });
});
