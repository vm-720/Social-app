import { RISK_CATEGORY_LABELS } from "@/lib/analysis/schema";
import { PLATFORM_LABELS, type ScoredComment } from "@/lib/dashboard";

const SENTIMENT_LABEL = { positive: "Positive", neutral: "Neutral", mixed: "Mixed", negative: "Negative" };

export function CommentItem({ c, actions }: { c: ScoredComment; actions?: React.ReactNode }) {
  const a = c.analysis;
  return (
    <div className="comment">
      <div className="meta">
        <span>{PLATFORM_LABELS[c.platform]}</span>
        <span>{c.authorName ?? "Unknown"}</span>
        <span>{c.postedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
        {a && <span className="chip">{SENTIMENT_LABEL[a.sentiment]}</span>}
        {a && a.riskLevel !== "none" && a.riskLevel !== "low" && (
          <span className={`chip risk-${a.riskLevel}`}>{a.riskLevel === "high" ? "High risk" : "Medium risk"}</span>
        )}
        {a?.riskCategories.map((cat) => (
          <span key={cat} className="chip">
            {RISK_CATEGORY_LABELS[cat as keyof typeof RISK_CATEGORY_LABELS] ?? cat}
          </span>
        ))}
        {a?.needsReply && <span className="chip">Needs reply</span>}
        {c.postUrl && (
          <a href={c.postUrl} target="_blank" rel="noreferrer">
            Open post
          </a>
        )}
        {actions}
      </div>
      <p>{c.text}</p>
      {a?.riskReason && <div className="reason">{a.riskReason}</div>}
    </div>
  );
}
