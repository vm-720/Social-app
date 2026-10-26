import Link from "next/link";
import type { Platform } from "@/db/schema";
import type { AppContext } from "@/lib/auth/context";
import { PLATFORMS, PLATFORM_LABELS, RANGES, type Filters } from "@/lib/dashboard";
import { switchAccount } from "./frame-actions";

type Tab = "overview" | "topics" | "risk" | "settings";
const TABS: { id: Tab; label: string; path: string }[] = [
  { id: "overview", label: "Overview", path: "/dashboard" },
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
  children,
}: {
  ctx: AppContext;
  active: Tab;
  /** Settings has no date or platform filters. */
  filters: Filters | null;
  children: React.ReactNode;
}) {
  const linkFilters = filters ?? { days: 30, platform: null };
  const path = TABS.find((t) => t.id === active)!.path;
  const platformOptions: (Platform | null)[] = [null, ...PLATFORMS];
  return (
    <main className="shell">
      <div className="userbar">
        {ctx.accounts.length > 1 && (
          <form action={switchAccount} className="switcher">
            <select name="accountId" defaultValue={ctx.current.account.id} aria-label="Business">
              {ctx.accounts.map((a) => (
                <option key={a.account.id} value={a.account.id}>
                  {a.account.name}
                </option>
              ))}
            </select>
            <button className="small" type="submit">
              Switch
            </button>
          </form>
        )}
        <Link href="/onboarding">Add a business</Link>
        <span>{ctx.user.email}</span>
        <form action="/auth/signout" method="post">
          <button className="small" type="submit">
            Sign out
          </button>
        </form>
      </div>
      <div className="topbar">
        <h1>{ctx.current.account.name}</h1>
        <nav className="tabs">
          {TABS.map((t) => (
            <Link key={t.id} href={t.id === "settings" ? t.path : hrefWith(t.path, linkFilters)} aria-current={t.id === active ? "page" : undefined}>
              {t.label}
            </Link>
          ))}
        </nav>
      </div>
      {filters && (
        <div className="filters">
          <div className="seg" role="group" aria-label="Date range">
            {RANGES.map((d) => (
              <Link key={d} href={hrefWith(path, { ...filters, days: d })} aria-current={filters.days === d}>
                Last {d} days
              </Link>
            ))}
          </div>
          <div className="seg" role="group" aria-label="Platform">
            {platformOptions.map((p) => (
              <Link key={p ?? "all"} href={hrefWith(path, { ...filters, platform: p })} aria-current={filters.platform === p}>
                {p ? PLATFORM_LABELS[p] : "All platforms"}
              </Link>
            ))}
          </div>
        </div>
      )}
      {children}
    </main>
  );
}
