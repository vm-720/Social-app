import Link from "next/link";
import { CommentCard } from "@/components/CommentCard";
import { Frame, hrefWith } from "@/components/Frame";
import { requireContext } from "@/lib/auth/context";
import { buildRiskQueue, loadComments, loadSuggestions, parseFilters, repliedIds, windowStart } from "@/lib/dashboard";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function Risk({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams;
  const filters = parseFilters(params);
  const showHandled = params.handled === "1";
  const ctx = await requireContext();
  const { db } = ctx;
  const account = ctx.current.account;

  const inWindow = (await loadComments(db, account.id, windowStart(filters))).filter(
    (c) => !filters.platform || c.platform === filters.platform,
  );
  const queue = buildRiskQueue(
    inWindow.filter((c) => !c.isOwned),
    showHandled,
  );
  const high = queue.filter((c) => c.analysis!.riskLevel === "high").length;
  const suggestions = await loadSuggestions(
    db,
    queue.map((c) => c.id),
  );
  const replied = repliedIds(inWindow);

  return (
    <Frame ctx={ctx} active="risk" filters={filters} keep={{ handled: showHandled ? "1" : null }}>
      <div className="page-head">
        <h1>Risk</h1>
        <p className="lead">
          {high} high and {queue.length - high} medium risk {queue.length === 1 ? "comment" : "comments"}
          {showHandled ? "" : " still open"}, high risk first. Check with whoever handles legal, safety or HR before
          replying in public.{" "}
          <Link href={hrefWith("/dashboard/risk", filters, { handled: showHandled ? null : "1" })}>
            {showHandled ? "Hide handled" : "Show handled"}
          </Link>
        </p>
      </div>
      <section className="block">
        {queue.length === 0 && <div className="empty">Nothing needs attention in this period.</div>}
        {queue.map((c) => (
          <CommentCard key={c.id} c={c} suggestion={suggestions.get(c.id) ?? null} replied={replied.has(c.externalId)} />
        ))}
      </section>
    </Frame>
  );
}
