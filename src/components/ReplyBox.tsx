"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { suggestReply, type ReplyState } from "@/app/dashboard/comments/actions";

const ADJUST_BUTTONS = [
  { id: "shorter", label: "Shorter" },
  { id: "warmer", label: "Warmer" },
  { id: "formal", label: "More formal" },
  { id: "again", label: "Try again" },
];

/**
 * The suggested reply under a comment. The text stays editable; "Copy and open post" puts it on
 * the clipboard and opens the post so the reply can be pasted in place.
 */
export function ReplyBox({
  commentId,
  initial,
  postUrl,
  platformLabel,
}: {
  commentId: string;
  initial: string | null;
  postUrl: string | null;
  platformLabel: string;
}) {
  const [state, action, pending] = useActionState<ReplyState, FormData>(suggestReply, { text: initial, error: null });
  const [draft, setDraft] = useState(initial ?? "");
  const [copied, setCopied] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (state.text !== null) setDraft(state.text);
  }, [state.text]);

  async function copyAndOpen() {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      area.current?.select();
    }
    if (postUrl) window.open(postUrl, "_blank", "noopener,noreferrer");
  }

  if (state.text === null) {
    return (
      <form action={action} className="reply reply-empty">
        <input type="hidden" name="id" value={commentId} />
        <button className="btn sm" type="submit" disabled={pending}>
          {pending ? "Writing a reply…" : "Suggest a reply"}
        </button>
        {state.error && <span className="form-error">{state.error}</span>}
      </form>
    );
  }

  return (
    <div className="reply">
      <span className="reply-rule" aria-hidden="true" />
      <div className="reply-body">
        <label className="eyebrow" htmlFor={`reply-${commentId}`}>
          Suggested reply
        </label>
        <textarea
          id={`reply-${commentId}`}
          ref={area}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={Math.min(8, Math.max(3, Math.ceil(draft.length / 90)))}
          disabled={pending}
        />
        <div className="reply-actions">
          <button className="btn primary sm" type="button" onClick={copyAndOpen} disabled={pending || !draft.trim()}>
            {copied ? "Copied" : postUrl ? `Copy and open on ${platformLabel}` : "Copy reply"}
          </button>
          <form action={action} className="reply-adjust">
            <input type="hidden" name="id" value={commentId} />
            <input type="hidden" name="previous" value={draft} />
            {ADJUST_BUTTONS.map((b) => (
              <button key={b.id} className="btn ghost sm" type="submit" name="adjust" value={b.id} disabled={pending}>
                {b.label}
              </button>
            ))}
          </form>
          {pending && <span className="muted">Rewriting…</span>}
        </div>
        {state.error && <span className="form-error">{state.error}</span>}
      </div>
    </div>
  );
}
