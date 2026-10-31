import Link from "next/link";
import type { Platform } from "@/db/schema";
import type { AppContext } from "@/lib/auth/context";
import { PLATFORMS, PLATFORM_LABELS, RANGES, RANGE_LABELS, type Filters } from "@/lib/dashboard";
import { switchAccount } from "./frame-actions";

type Tab = "briefing" | "comments" | "topics" | "risk" | "settings";
const TABS: { id: Tab; label: string; path: string }[] = [
  { id: "briefing", label: "Briefing", path: "/dashboard" },
  { id: "comments", label: "Comments", path: "/dashboard/comments" },
  { id: "topics", label: "Topics", path: "/dashboard/topics" },
  { id: "risk", label: "Risk", path: "/dashboard/risk" },
  { id: "settings", label: "Settings", path: "/dashboard/settings" },
];

export function hrefWith(path: string, filters: Filters, extra: Record<string, string | null> = {}) {
  const qs = new URLSearchParams();
  qs.set("days", String(filters.days));
  if (filters.platform) qs.set("platform", filters.platform);
  for (const [k, v] of Object.entries(extra)) if (v !== null) qs.set(k, v);
  return `${path}?${qs}`;
}

export function Frame({
  ctx,
  active,
  filters,
  keep = {},
  children,
}: {
  ctx: AppContext;
  active: Tab;
  /** Settings has no date or platform filters. */
  filters: Filters | null;
  /** Extra query values a page wants kept when the filters change. */
  keep?: Record<string, string | null>;
  children: React.ReactNode;
}) {
  const linkFilters = filters ?? { days: 30, platform: null };
  const path = TABS.find((t) => t.id === active)!.path;
  const platformOptions: (Platform | null)[] = [null, ...PLATFORMS];
  return (
    <div className="app">
      <header className="appbar">
        <div className="brand">
          <span className="wordmark">Sentiment</span>
          {ctx.accounts.length > 1 ? (
            <form action={switchAccount} className="switcher">
              <select name="accountId" defaultValue={ctx.current.account.id} aria-label="Business">
                {ctx.accounts.map((a) => (
                  <option key={a.account.id} value={a.account.id}>
                    {a.account.name}
                  </option>
                ))}
              </select>
              <button className="btn ghost sm" type="submit">
                Switch
              </button>
            </form>
          ) : (
            <span className="business">{ctx.current.account.name}</span>
          )}
        </div>
        <nav className="tabs" aria-label="Main">
          {TABS.map((t) => (
            <Link
              key={t.id}
              href={t.id === "settings" ? t.path : hrefWith(t.path, linkFilters)}
              aria-current={t.id === active ? "page" : undefined}
            >
              {t.label}
            </Link>
          ))}
        </nav>
        <details className="menu">
          <summary aria-label="Account">{ctx.user.email.slice(0, 1).toUpperCase()}</summary>
          <div className="menu-body">
            <div className="muted">{ctx.user.email}</div>
            <Link href="/onboarding">Add a business</Link>
            <form action="/auth/signout" method="post">
              <button className="btn ghost sm" type="submit">
                Sign out
              </button>
            </form>
          </div>
        </details>
      </header>
      <main className="page">
        {filters && (
          <div className="filters">
            <div className="seg" role="group" aria-label="Date range">
              {RANGES.map((d) => (
                <Link key={d} href={hrefWith(path, { ...filters, days: d }, keep)} aria-current={filters.days === d}>
                  {RANGE_LABELS[d]}
                </Link>
              ))}
            </div>
            <div className="seg" role="group" aria-label="Platform">
              {platformOptions.map((p) => (
                <Link key={p ?? "all"} href={hrefWith(path, { ...filters, platform: p }, keep)} aria-current={filters.platform === p}>
                  {p ? PLATFORM_LABELS[p] : "All platforms"}
                </Link>
              ))}
            </div>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
