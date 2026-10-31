import Link from "next/link";
import { leanOf, VERDICTS, verdictFor } from "@/lib/metrics";

/**
 * The five-band scale from Very negative to Very positive, with a marker at the positive share.
 */
export function SentimentScale({ share, label = "You" }: { share: number | null; label?: string }) {
  const verdict = verdictFor(share);
  return (
    <div className="scale">
      <div className="scale-marker-row" aria-hidden="true">
        {share !== null && (
          <span className="scale-flag" style={{ left: `${share}%` }}>
            {label} · {share}%
          </span>
        )}
      </div>
      <div
        className="scale-track"
        role="img"
        aria-label={share === null ? "No comments with an opinion yet" : `${share}% positive: ${verdict!.label}`}
      >
        {VERDICTS.map((v) => (
          <span key={v.id} className={`band band-${v.id}`} />
        ))}
        {share !== null && <span className="scale-pin" style={{ left: `${share}%` }} />}
      </div>
      <div className="scale-labels">
        {VERDICTS.map((v) => (
          <span key={v.id} className={verdict?.id === v.id ? "on" : undefined}>
            {v.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function VerdictChip({ share }: { share: number | null }) {
  const v = verdictFor(share);
  return <span className={`chip lean-${leanOf(share)}`}>{v ? v.label : "No opinions yet"}</span>;
}

export interface DotRow {
  key: string;
  label: string;
  share: number | null;
  total: number;
  posts: number;
  href?: string;
  current?: boolean;
}

/**
 * One row per topic or platform. A dot sits on a track from "All negative" to "All positive",
 * with the comment and post counts beside it.
 */
export function DotChart({ rows, unit = "comments" }: { rows: DotRow[]; unit?: string }) {
  return (
    <div className="dots">
      <div className="dots-head" aria-hidden="true">
        <span />
        <span className="dots-axis">
          <span>All negative</span>
          <span>Split</span>
          <span>All positive</span>
        </span>
        <span className="right">{unit === "comments" ? "Comments" : unit}</span>
      </div>
      {rows.map((r) => {
        const inner = (
          <>
            <span className="dots-name">{r.label}</span>
            <span
              className="dots-track"
              role="img"
              aria-label={
                r.share === null ? `${r.label}: no comments with an opinion` : `${r.label}: ${r.share}% positive`
              }
            >
              {r.share !== null && (
                <span className={`dot lean-${leanOf(r.share)}`} style={{ left: `${r.share}%` }}>
                  <span className="dot-tip">{r.share}%</span>
                </span>
              )}
            </span>
            <span className="dots-count">
              <strong>{r.total}</strong> on {r.posts} {r.posts === 1 ? "post" : "posts"}
            </span>
          </>
        );
        return r.href ? (
          <Link key={r.key} href={r.href} className="dots-row" aria-current={r.current || undefined}>
            {inner}
          </Link>
        ) : (
          <div key={r.key} className="dots-row">
            {inner}
          </div>
        );
      })}
    </div>
  );
}
