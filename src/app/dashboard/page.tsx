import Link from "next/link";
import { CommentCard } from "@/components/CommentCard";
import { Frame, hrefWith } from "@/components/Frame";
import { DotChart, SentimentScale } from "@/components/Sentiment";
import { requireContext } from "@/lib/auth/context";
import {
  buildDrivers,
  buildInbox,
  buildOverview,
  buildTopics,
  loadComments,
  loadSuggestions,
  loadTopicNames,
  parseFilters,
  PLATFORM_LABELS,
  repliedIds,
  windowStart,
  type ScoredComment,
  type TopicRow,
} from "@/lib/dashboard";
import { leanOf, verdictFor } from "@/lib/metrics";

export const dynamic = "force-dynamic";

const fmtDay = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

function listNames(names: string[]) {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function clip(text: string, max = 140) {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** The comment that best shows why a topic leans the way it does. */
function exampleFor(row: TopicRow, list: ScoredComment[], lean: "up" | "down") {
  const inTopic = list.filter((c) => c.analysis!.topics.includes(row.topic));
  const sorted = inTopic.sort((a, b) => a.analysis!.sentimentScore - b.analysis!.sentimentScore);
  return lean === "up" ? sorted[sorted.length - 1] : sorted[0];
}

function Driver({ row, example, lean }: { row: TopicRow; example: ScoredComment | undefined; lean: "up" | "down" }) {
  return (
    <div className="driver">
      <div className="driver-head">
        <strong>{row.topic}</strong>
        <span className={lean === "up" ? "pos-text" : "neg-text"}>{row.share}% positive</span>
      </div>
      <div className="muted">
        {row.counts.positive} positive, {row.counts.negative} negative across {row.posts}{" "}
        {row.posts === 1 ? "post" : "posts"}
      </div>
      {example && <blockquote>“{clip(example.text)}”</blockquote>}
    </div>
  );
}

export default async function Briefing({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const filters = parseFilters(await searchParams);
  const ctx = await requireContext();
  const { db } = ctx;
  const account = ctx.current.account;

  const now = new Date();
  const since = new Date(now.getTime() - 2 * filters.days * 24 * 60 * 60 * 1000);
  const all = await loadComments(db, account.id, since);
  const o = buildOverview(all, filters, now);
  const start = windowStart(filters, now);

  const inWindow = all.filter((c) => c.postedAt >= start && (!filters.platform || c.platform === filters.platform));
  const publicScored = inWindow.filter((c) => !c.isOwned && c.analysis);
  const topics = buildTopics(publicScored, await loadTopicNames(db, account.id));
  const drivers = buildDrivers(topics);
  const waiting = buildInbox(inWindow, { view: "waiting" });
  const queue = waiting.slice(0, 3);
  const suggestions = await loadSuggestions(
    db,
    queue.map((c) => c.id),
  );
  const replied = repliedIds(inWindow);

  const verdict = verdictFor(o.share);
  const lean = leanOf(o.share);
  const delta = o.share !== null && o.prevShare !== null ? o.share - o.prevShare : null;
  const where = filters.platform ? ` on ${PLATFORM_LABELS[filters.platform]}` : "";

  return (
    <Frame ctx={ctx} active="briefing" filters={filters}>
      <section className="hero">
        <div className="muted">
          Your briefing for {fmtDay(start)} to {fmtDay(now)}
          {where} · {o.scored} {o.scored === 1 ? "comment" : "comments"} on {o.posts} {o.posts === 1 ? "post" : "posts"}
        </div>
        {verdict ? (
          <h1 className="headline">
            People are <span className={`lean-text-${lean}`}>{verdict.label.toLowerCase()}</span> about you.
          </h1>
        ) : (
          <h1 className="headline">Nothing to report yet.</h1>
        )}
        <p className="summary">
          {o.share === null ? (
            o.scored === 0 ? (
              <>
                No public comments in this period. Connect your pages or check for new comments in{" "}
                <Link href="/dashboard/settings">Settings</Link>.
              </>
            ) : (
              "Comments came in, but none took a clear side yet."
            )
          ) : (
            <>
              {o.share}% of comments with an opinion were positive ({o.counts.positive} positive, {o.counts.negative}{" "}
              negative).{" "}
              {delta !== null &&
                (delta === 0
                  ? `That's the same as the ${filters.days} days before. `
                  : `That's ${delta > 0 ? "up" : "down"} ${Math.abs(delta)} points from the ${filters.days} days before. `)}
              {drivers.up.length > 0 && `${listNames(drivers.up.map((d) => d.topic))} ${drivers.up.length === 1 ? "is" : "are"} winning people over. `}
              {drivers.down.length > 0 && `${listNames(drivers.down.map((d) => d.topic))} ${drivers.down.length === 1 ? "is" : "are"} pulling you down.`}
            </>
          )}
        </p>
        <SentimentScale share={o.share} />
      </section>

      <section className="stats" aria-label="Key numbers">
        <Link className="stat" href={hrefWith("/dashboard/comments", filters)}>
          <span className="stat-label">Waiting for a reply</span>
          <span className="stat-value">{waiting.length}</span>
          <span className="stat-link">Open comments</span>
        </Link>
        <Link className="stat" href={hrefWith("/dashboard/risk", filters)}>
          <span className="stat-label">Open high-risk comments</span>
          <span className={`stat-value ${o.openHighRisk ? "neg-text" : ""}`}>{o.openHighRisk}</span>
          <span className="stat-link">Review risk</span>
        </Link>
        <div className="stat">
          <span className="stat-label">Replied to</span>
          <span className="stat-value">
            {o.replied} of {o.needsReply}
          </span>
          <span className="muted">comments that asked for a response</span>
        </div>
      </section>

      {(drivers.up.length > 0 || drivers.down.length > 0) && (
        <section className="drivers" aria-label="What is driving sentiment">
          <div className="driver-card up">
            <h2>Lifting you up</h2>
            {drivers.up.length === 0 && <p className="muted">No topic is clearly positive yet.</p>}
            {drivers.up.map((r) => (
              <Driver key={r.topic} row={r} example={exampleFor(r, publicScored, "up")} lean="up" />
            ))}
          </div>
          <div className="driver-card down">
            <h2>Pulling you down</h2>
            {drivers.down.length === 0 && <p className="muted">No topic is clearly negative. Nice.</p>}
            {drivers.down.map((r) => (
              <Driver key={r.topic} row={r} example={exampleFor(r, publicScored, "down")} lean="down" />
            ))}
          </div>
        </section>
      )}

      {topics.length > 0 && (
        <section className="block">
          <div className="block-head">
            <h2>Where each topic lands</h2>
            <Link href={hrefWith("/dashboard/topics", filters)}>All topics</Link>
          </div>
          <p className="lead">Each dot is the share of positive comments. Left of the middle leans negative, right leans positive.</p>
          <DotChart
            rows={topics.slice(0, 8).map((t) => ({
              key: t.topic,
              label: t.topic,
              share: t.share,
              total: t.total,
              posts: t.posts,
              href: hrefWith("/dashboard/topics", filters, { topic: t.topic }),
            }))}
          />
        </section>
      )}

      {!filters.platform && o.platforms.length > 1 && (
        <section className="block">
          <h2>By platform</h2>
          <DotChart
            rows={o.platforms.map((p) => ({
              key: p.platform,
              label: PLATFORM_LABELS[p.platform],
              share: p.share,
              total: p.total,
              posts: p.posts,
              href: hrefWith("/dashboard", { ...filters, platform: p.platform }),
            }))}
          />
        </section>
      )}

      <section className="block">
        <div className="block-head">
          <h2>
            {waiting.length === 0
              ? "Nobody is waiting on a reply"
              : `${waiting.length} ${waiting.length === 1 ? "person is" : "people are"} waiting on you`}
          </h2>
          {waiting.length > 0 && <Link href={hrefWith("/dashboard/comments", filters)}>Open all comments</Link>}
        </div>
        {queue.map((c) => (
          <CommentCard key={c.id} c={c} suggestion={suggestions.get(c.id) ?? null} replied={replied.has(c.externalId)} />
        ))}
      </section>
    </Frame>
  );
}
