import { totalOf, type SentimentCounts } from "@/lib/metrics";

const ORDER: { key: keyof SentimentCounts; label: string; color: string }[] = [
  { key: "positive", label: "Positive", color: "var(--positive)" },
  { key: "neutral", label: "Neutral", color: "var(--neutral)" },
  { key: "mixed", label: "Mixed", color: "var(--mixed)" },
  { key: "negative", label: "Negative", color: "var(--negative)" },
];

/** 100% stacked bars, one per row, positive on the left and negative on the right. */
export function SentimentMix({ rows }: { rows: { label: string; counts: SentimentCounts }[] }) {
  return (
    <div>
      <div className="legend">
        {ORDER.map((o) => (
          <span key={o.key}>
            <span className="swatch" style={{ background: o.color }} />
            {o.label}
          </span>
        ))}
      </div>
      {rows.map((r) => {
        const total = totalOf(r.counts);
        return (
          <div className="stack-row" key={r.label}>
            <span>{r.label}</span>
            <div className="stack">
              {ORDER.filter((o) => r.counts[o.key] > 0).map((o) => {
                const pct = Math.round((r.counts[o.key] / total) * 100);
                return (
                  <span
                    key={o.key}
                    title={`${r.label}: ${o.label} ${r.counts[o.key]} of ${total} (${pct}%)`}
                    style={{ width: `${(r.counts[o.key] / total) * 100}%`, background: o.color }}
                  />
                );
              })}
            </div>
            <span className="num">{total}</span>
          </div>
        );
      })}
    </div>
  );
}
