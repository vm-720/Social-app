import Link from "next/link";
import { CommentItem } from "@/components/CommentItem";
import { Frame, hrefWith } from "@/components/Frame";
import { getDb } from "@/db/client";
import { buildRiskQueue, getCurrentAccount, loadComments, parseFilters, windowStart } from "@/lib/dashboard";
import { NoAccount } from "../no-account";
import { setHandled } from "./actions";

export const dynamic = "force-dynamic";

export default async function Risk({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams;
  const filters = parseFilters(params);
  const showHandled = params.handled === "1";
  const db = getDb();
  const account = await getCurrentAccount(db);
  if (!account) return <NoAccount />;

  const list = (await loadComments(db, account.id, windowStart(filters))).filter(
    (c) => !c.isOwned && (!filters.platform || c.platform === filters.platform),
  );
  const queue = buildRiskQueue(list, showHandled);
  const high = queue.filter((c) => c.analysis!.riskLevel === "high").length;

  return (
    <Frame accountName={account.name} active="risk" filters={filters}>
      <section className="card">
        <h2>Risk queue</h2>
        <p className="lead">
          {high} high and {queue.length - high} medium risk comments{showHandled ? "" : " still open"}, high risk
          first, newest at the top.{" "}
          <Link href={hrefWith("/dashboard/risk", filters, { handled: showHandled ? null : "1" })}>
            {showHandled ? "Hide handled" : "Show handled"}
          </Link>
        </p>
        {queue.length === 0 && <div className="empty">Nothing needs attention in this period.</div>}
        {queue.map((c) => (
          <CommentItem
            key={c.id}
            c={c}
            actions={
              <form action={setHandled} style={{ marginLeft: "auto" }}>
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="handled" value={c.handledAt ? "0" : "1"} />
                <button className="small" type="submit">
                  {c.handledAt ? "Reopen" : "Mark handled"}
                </button>
              </form>
            }
          />
        ))}
      </section>
    </Frame>
  );
}
