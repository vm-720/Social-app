import Link from "next/link";
import { CommentCard } from "@/components/CommentCard";
import { Frame, hrefWith } from "@/components/Frame";
import { requireContext } from "@/lib/auth/context";
import {
  buildInbox,
  INBOX_VIEWS,
  loadComments,
  loadSuggestions,
  loadTopicNames,
  parseFilters,
  repliedIds,
  windowStart,
  type InboxView,
} from "@/lib/dashboard";

export const dynamic = "force-dynamic";
// Writing a suggested reply calls Claude from this page's action.
export const maxDuration = 60;

const VIEW_LABELS: Record<InboxView, string> = {
  waiting: "Waiting for a reply",
  all: "All comments",
  positive: "Positive",
  negative: "Negative",
  risk: "Risky",
  handled: "Handled",
};
const PAGE = 40;

export default async function Comments({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams;
  const filters = parseFilters(params);
  const view: InboxView = (INBOX_VIEWS as readonly string[]).includes(params.view) ? (params.view as InboxView) : "waiting";
  const q = params.q?.slice(0, 100) || null;
  const limit = Math.min(1000, Math.max(PAGE, Number(params.limit) || PAGE));
  const ctx = await requireContext();
  const { db } = ctx;
  const account = ctx.current.account;

  const topicNames = await loadTopicNames(db, account.id);
  const topic = params.topic && [...topicNames, "Other"].includes(params.topic) ? params.topic : null;
  const all = (await loadComments(db, account.id, windowStart(filters))).filter(
    (c) => !filters.platform || c.platform === filters.platform,
  );
  const replied = repliedIds(all);
  const counts = Object.fromEntries(INBOX_VIEWS.map((v) => [v, buildInbox(all, { view: v, topic, q }).length]));
  const list = buildInbox(all, { view, topic, q });
  const shown = list.slice(0, limit);
  const suggestions = await loadSuggestions(
    db,
    shown.map((c) => c.id),
  );
  const keep = { view, topic, q };

  return (
    <Frame ctx={ctx} active="comments" filters={filters} keep={keep}>
      <div className="page-head">
        <h1>Comments</h1>
        <p className="lead">
          Every public comment from your connected pages, with a link to the post it was left on. Your own replies are
          left out.
        </p>
      </div>

      <div className="inbox-bar">
        <nav className="pills" aria-label="Show">
          {INBOX_VIEWS.map((v) => (
            <Link key={v} href={hrefWith("/dashboard/comments", filters, { ...keep, view: v })} aria-current={v === view}>
              {VIEW_LABELS[v]} <span className="count">{counts[v]}</span>
            </Link>
          ))}
        </nav>
        <form className="search" action="/dashboard/comments">
          <input type="hidden" name="days" value={filters.days} />
          {filters.platform && <input type="hidden" name="platform" value={filters.platform} />}
          <input type="hidden" name="view" value={view} />
          <select name="topic" defaultValue={topic ?? ""} aria-label="Topic">
            <option value="">All topics</option>
            {[...topicNames, "Other"].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input type="search" name="q" defaultValue={q ?? ""} placeholder="Search comments or names" aria-label="Search" />
          <button className="btn sm" type="submit">
            Search
          </button>
        </form>
      </div>

      <section className="block">
        {list.length === 0 && (
          <div className="empty">
            {view === "waiting" ? "Nobody is waiting on a reply. You're all caught up." : "No comments match."}
          </div>
        )}
        {shown.map((c) => (
          <CommentCard key={c.id} c={c} suggestion={suggestions.get(c.id) ?? null} replied={replied.has(c.externalId)} />
        ))}
        {list.length > shown.length && (
          <div className="more">
            <Link className="btn" href={hrefWith("/dashboard/comments", filters, { ...keep, limit: String(limit + PAGE) })}>
              Show more ({list.length - shown.length} left)
            </Link>
          </div>
        )}
      </section>
    </Frame>
  );
}
