import Link from "next/link";
import { CommentItem } from "@/components/CommentItem";
import { Frame, hrefWith } from "@/components/Frame";
import { requireContext } from "@/lib/auth/context";
import { buildTopics, loadComments, loadTopicNames, parseFilters, windowStart } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

function fmtNet(n: number | null) {
  if (n === null) return "–";
  return n > 0 ? `+${n}` : String(n);
}

export default async function Topics({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams;
  const filters = parseFilters(params);
  const ctx = await requireContext();
  const { db } = ctx;
  const account = ctx.current.account;

  const list = (await loadComments(db, account.id, windowStart(filters))).filter(
    (c) => !c.isOwned && c.analysis && (!filters.platform || c.platform === filters.platform),
  );
  const rows = buildTopics(list, await loadTopicNames(db, account.id));
  const selected = rows.find((r) => r.topic === params.topic)?.topic ?? null;
  const inTopic = selected
    ? list
        .filter((c) => c.analysis!.topics.includes(selected))
        .sort((a, b) => a.analysis!.sentimentScore - b.analysis!.sentimentScore)
    : [];

  return (
    <Frame ctx={ctx} active="topics" filters={filters}>
      <section className="card">
        <h2>Net Sentiment by topic</h2>
        <p className="lead">
          Bars run left for negative and right for positive. Sorted by number of comments. Pick a topic to read its
          comments.
        </p>
        <div className="legend">
          <span>
            <span className="swatch" style={{ background: "var(--positive)" }} />
            Net positive
          </span>
          <span>
            <span className="swatch" style={{ background: "var(--negative)" }} />
            Net negative
          </span>
          <span style={{ marginLeft: "auto" }}>Net score · comments</span>
        </div>
        {rows.length === 0 && <div className="empty">No scored comments in this period.</div>}
        {rows.map((r) => {
          const net = r.net ?? 0;
          const width = (Math.abs(net) / 100) * 50;
          return (
            <Link
              key={r.topic}
              className="div-row"
              href={hrefWith("/dashboard/topics", filters, { topic: r.topic })}
              aria-current={selected === r.topic}
              title={`${r.topic}: Net ${fmtNet(r.net)}, ${r.total} comments, ${r.negative} negative`}
            >
              <span>{r.topic}</span>
              <span className="div-track">
                <span
                  className="div-bar"
                  style={{
                    width: `${width}%`,
                    left: net >= 0 ? "50%" : `${50 - width}%`,
                    background: net >= 0 ? "var(--positive)" : "var(--negative)",
                    borderRadius: net >= 0 ? "0 4px 4px 0" : "4px 0 0 4px",
                  }}
                />
              </span>
              <span className="num">{fmtNet(r.net)}</span>
              <span className="num neg">{r.total}</span>
            </Link>
          );
        })}
      </section>

      {selected && (
        <section className="card">
          <h2>{selected}</h2>
          <p className="lead">{inTopic.length} comments, most negative first.</p>
          {inTopic.map((c) => (
            <CommentItem key={c.id} c={c} />
          ))}
        </section>
      )}
    </Frame>
  );
}
