import { Frame } from "@/components/Frame";
import { SentimentMix } from "@/components/SentimentMix";
import { TrendChart } from "@/components/TrendChart";
import { requireContext } from "@/lib/auth/context";
import { buildOverview, loadComments, parseFilters, PLATFORM_LABELS, PLATFORMS } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

const PLATFORM_COLORS = {
  facebook: "var(--series-1)",
  instagram: "var(--series-2)",
  linkedin: "var(--series-3)",
  tiktok: "var(--series-4)",
};

function fmtNet(n: number | null) {
  if (n === null) return "–";
  return n > 0 ? `+${n}` : String(n);
}

export default async function Overview({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const filters = parseFilters(await searchParams);
  const ctx = await requireContext();
  const { db } = ctx;
  const account = ctx.current.account;

  const since = new Date(Date.now() - 2 * filters.days * 24 * 60 * 60 * 1000);
  const all = await loadComments(db, account.id, since);
  const o = buildOverview(all, filters);
  const delta = o.net !== null && o.prevNet !== null ? o.net - o.prevNet : null;

  const shown = PLATFORMS.filter((p) => o.trend.some((t) => t.values[p] !== undefined));
  const trendData = o.trend.map((t) => ({ week: t.week, ...t.values }));

  return (
    <Frame ctx={ctx} active="overview" filters={filters}>
      <section className="tiles">
        <div className="tile">
          <div className="label">Net Sentiment</div>
          <div className="value">{fmtNet(o.net)}</div>
          <div className="sub">
            {delta === null ? (
              "No earlier period to compare"
            ) : (
              <span className={delta >= 0 ? "up" : "down"}>
                {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)} vs previous {filters.days} days
              </span>
            )}
          </div>
        </div>
        <div className="tile">
          <div className="label">Comments from the public</div>
          <div className="value">{o.scored}</div>
          <div className="sub">
            {o.counts.positive} positive · {o.counts.negative} negative
          </div>
        </div>
        <div className="tile">
          <div className="label">Open high-risk comments</div>
          <div className={`value ${o.openHighRisk ? "down" : ""}`}>{o.openHighRisk}</div>
          <div className="sub">
            <a href={`/dashboard/risk?days=${filters.days}`}>Review risk queue</a>
          </div>
        </div>
        <div className="tile">
          <div className="label">Replied to</div>
          <div className="value">
            {o.replied} of {o.needsReply}
          </div>
          <div className="sub">comments that asked for a response</div>
        </div>
      </section>

      <section className="card">
        <h2>Net Sentiment by week</h2>
        <p className="lead">Positive minus negative, as a share of all scored comments, from -100 to +100.</p>
        {trendData.length ? (
          <TrendChart
            data={trendData}
            series={shown.map((p) => ({ key: p, label: PLATFORM_LABELS[p], color: PLATFORM_COLORS[p] }))}
          />
        ) : (
          <div className="empty">No scored comments in this period.</div>
        )}
      </section>

      <section className="card">
        <h2>Sentiment mix by platform</h2>
        <p className="lead">Share of comments in each sentiment. Hover a segment for counts.</p>
        {o.mix.length ? (
          <SentimentMix rows={o.mix.map((m) => ({ label: PLATFORM_LABELS[m.platform], counts: m.counts }))} />
        ) : (
          <div className="empty">No scored comments in this period.</div>
        )}
      </section>
    </Frame>
  );
}
