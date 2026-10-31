import Link from "next/link";
import { CommentCard } from "@/components/CommentCard";
import { Frame, hrefWith } from "@/components/Frame";
import { DotChart, VerdictChip } from "@/components/Sentiment";
import { requireContext } from "@/lib/auth/context";
import {
  buildTopics,
  loadComments,
  loadSuggestions,
  loadTopicNames,
  parseFilters,
  repliedIds,
  windowStart,
} from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function Topics({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams;
  const filters = parseFilters(params);
  const ctx = await requireContext();
  const { db } = ctx;
  const account = ctx.current.account;

  const inWindow = (await loadComments(db, account.id, windowStart(filters))).filter(
    (c) => !filters.platform || c.platform === filters.platform,
  );
  const list = inWindow.filter((c) => !c.isOwned && c.analysis);
  const rows = buildTopics(list, await loadTopicNames(db, account.id));
  const selected = rows.find((r) => r.topic === params.topic) ?? null;
  const inTopic = selected
    ? list
        .filter((c) => c.analysis!.topics.includes(selected.topic))
        .sort((a, b) => a.analysis!.sentimentScore - b.analysis!.sentimentScore)
    : [];
  const suggestions = await loadSuggestions(
    db,
    inTopic.map((c) => c.id),
  );
  const replied = repliedIds(inWindow);

  return (
    <Frame ctx={ctx} active="topics" filters={filters} keep={{ topic: selected?.topic ?? null }}>
      <div className="page-head">
        <h1>Topics</h1>
        <p className="lead">
          Claude tags every comment with up to three topics. Each dot shows the share of positive comments for that
          topic, among comments that took a side. Pick a topic to read what people said.
        </p>
      </div>

      <section className="block">
        {rows.length === 0 ? (
          <div className="empty">No scored comments in this period.</div>
        ) : (
          <DotChart
            rows={rows.map((r) => ({
              key: r.topic,
              label: r.topic,
              share: r.share,
              total: r.total,
              posts: r.posts,
              current: selected?.topic === r.topic,
              href: hrefWith("/dashboard/topics", filters, { topic: r.topic }),
            }))}
          />
        )}
      </section>

      {selected && (
        <section className="block" id="comments">
          <div className="block-head">
            <h2>{selected.topic}</h2>
            <Link href={hrefWith("/dashboard/topics", filters)}>Close</Link>
          </div>
          <div className="topic-summary">
            <VerdictChip share={selected.share} />
            <span>
              {selected.share === null ? "No comment took a side" : `${selected.share}% positive`} ·{" "}
              {selected.counts.positive} positive, {selected.counts.negative} negative,{" "}
              {selected.counts.neutral + selected.counts.mixed} neutral or mixed · {selected.total}{" "}
              {selected.total === 1 ? "comment" : "comments"} on {selected.posts} {selected.posts === 1 ? "post" : "posts"}
            </span>
          </div>
          <p className="lead">Most negative first.</p>
          {inTopic.map((c) => (
            <CommentCard key={c.id} c={c} suggestion={suggestions.get(c.id) ?? null} replied={replied.has(c.externalId)} />
          ))}
        </section>
      )}
    </Frame>
  );
}
