import { setHandled } from "@/app/dashboard/comments/actions";
import { RISK_CATEGORY_LABELS } from "@/lib/analysis/schema";
import { PLATFORM_LABELS, type ScoredComment } from "@/lib/dashboard";
import { ReplyBox } from "./ReplyBox";

const SENTIMENT = {
  positive: { label: "Positive", lean: "positive" },
  negative: { label: "Negative", lean: "negative" },
  mixed: { label: "Mixed", lean: "mixed" },
  neutral: { label: "Neutral", lean: "none" },
} as const;

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/**
 * One public comment: who said it where, a link to the post, Claude's read of it, and (when
 * `reply` is on) the suggested reply box.
 */
export function CommentCard({
  c,
  suggestion,
  replied = false,
  reply = true,
}: {
  c: ScoredComment;
  suggestion: string | null;
  replied?: boolean;
  reply?: boolean;
}) {
  const a = c.analysis;
  const platform = PLATFORM_LABELS[c.platform];
  const risky = a && (a.riskLevel === "high" || a.riskLevel === "medium");
  const done = !!c.handledAt || replied;
  return (
    <article className="comment-card">
      <div className="comment-meta">
        <strong className="author">{c.authorName ?? "Someone"}</strong>
        <span>
          {platform} · {fmtDate(c.postedAt)}
        </span>
        {a && <span className={`chip lean-${SENTIMENT[a.sentiment].lean}`}>{SENTIMENT[a.sentiment].label}</span>}
        {risky && (
          <span className={`chip risk-${a.riskLevel}`}>
            {a.riskLevel === "high" ? "High risk" : "Medium risk"}
            {a.riskCategories.length > 0 &&
              ` · ${a.riskCategories
                .map((cat) => RISK_CATEGORY_LABELS[cat as keyof typeof RISK_CATEGORY_LABELS] ?? cat)
                .join(", ")}`}
          </span>
        )}
        {replied && <span className="chip">You replied</span>}
        {c.postUrl && (
          <a className="post-link" href={c.postUrl} target="_blank" rel="noreferrer">
            View post on {platform}
          </a>
        )}
        <form action={setHandled} className={c.postUrl ? "handled" : "handled push"}>
          <input type="hidden" name="id" value={c.id} />
          <input type="hidden" name="handled" value={c.handledAt ? "0" : "1"} />
          <button className="btn ghost sm" type="submit">
            {c.handledAt ? "Reopen" : "Mark handled"}
          </button>
        </form>
      </div>
      <p className="comment-text">{c.text}</p>
      {a && (
        <div className="comment-read">
          {risky && a.riskReason ? a.riskReason : a.summary}
          {a.topics.length > 0 && <span className="topics"> · {a.topics.join(", ")}</span>}
        </div>
      )}
      {reply && !done && (
        <ReplyBox commentId={c.id} initial={suggestion} postUrl={c.postUrl} platformLabel={platform} />
      )}
    </article>
  );
}
