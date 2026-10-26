import Link from "next/link";
import type { Platform } from "@/db/schema";
import { PLATFORMS, PLATFORM_LABELS, RANGES, type Filters } from "@/lib/dashboard";

type Tab = "overview" | "topics" | "risk";
const TABS: { id: Tab; label: string; path: string }[] = [
  { id: "overview", label: "Overview", path: "/dashboard" },
  { id: "topics", label: "Topics", path: "/dashboard/topics" },
  { id: "risk", label: "Risk", path: "/dashboard/risk" },
];

export function hrefWith(path: string, filters: Filters, extra: Record<string, string | null> = {}) {
  const qs = new URLSearchParams();
  qs.set("days", String(filters.days));
  if (filters.platform) qs.set("platform", filters.platform);
  for (const [k, v] of Object.entries(extra)) if (v !== null) qs.set(k, v);
  return `${path}?${qs}`;
}

export function Frame({
  accountName,
  active,
  filters,
  children,
}: {
  accountName: string;
  active: Tab;
  filters: Filters;
  children: React.ReactNode;
}) {
  const path = TABS.find((t) => t.id === active)!.path;
  const platformOptions: (Platform | null)[] = [null, ...PLATFORMS];
  return (
    <main className="shell">
      <div className="topbar">
        <h1>{accountName}</h1>
        <nav className="tabs">
          {TABS.map((t) => (
            <Link key={t.id} href={hrefWith(t.path, filters)} aria-current={t.id === active ? "page" : undefined}>
              {t.label}
            </Link>
          ))}
        </nav>
      </div>
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
      {children}
    </main>
  );
}
