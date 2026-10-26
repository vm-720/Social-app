import { asc, count, eq } from "drizzle-orm";
import { Frame } from "@/components/Frame";
import { comments, connections, invites, memberships, topics } from "@/db/schema";
import { requireContext } from "@/lib/auth/context";
import { PLATFORM_LABELS } from "@/lib/dashboard";
import { metaConfigured } from "@/lib/meta-oauth";
import {
  addTopic,
  checkNow,
  disconnect,
  inviteMember,
  removeMember,
  removeTopic,
  renameBusiness,
  revokeInvite,
  saveBrandAccounts,
} from "./actions";

export const dynamic = "force-dynamic";
// A first check can fetch and score hundreds of comments.
export const maxDuration = 300;

const CONNECT_MESSAGES: Record<string, string> = {
  not_configured: "Facebook and Instagram can't be connected until META_APP_ID and META_APP_SECRET are set.",
  expired: "That sign-in took too long or was started from another business. Please try again.",
  cancelled: "Facebook sign-in was cancelled, so nothing was connected.",
  no_pages: "Facebook didn't share any Pages. Try again and select your Page when Facebook asks.",
  failed: "Facebook didn't accept the sign-in. Please try again.",
};

function connectMessage(status: string | undefined) {
  if (!status) return null;
  const ok = /^ok_(\d+)$/.exec(status);
  if (ok) return `Connected ${ok[1]} page${ok[1] === "1" ? "" : "s"}. Press "Check for new comments now" to pull in comments.`;
  return CONNECT_MESSAGES[status] ?? null;
}

function checkMessage(p: Record<string, string | undefined>) {
  if (!p.checked) return null;
  const n = (k: string) => Number(p[k]) || 0;
  return `Checked: found ${n("fetched")} comment${n("fetched") === 1 ? "" : "s"}, ${n("added")} new, ${n("scored")} scored.`;
}

export default async function Settings({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const notice = connectMessage(params.connect);
  const checked = checkMessage(params);
  const problem = params.checked ? params.problem?.slice(0, 300) : undefined;
  const ctx = await requireContext();
  const { db } = ctx;
  const account = ctx.current.account;
  const owner = ctx.current.role === "owner";
  const [topicRows, conns, members, pending, stored] = await Promise.all([
    db.select().from(topics).where(eq(topics.accountId, account.id)).orderBy(asc(topics.sortOrder)),
    db.select().from(connections).where(eq(connections.accountId, account.id)),
    db.select().from(memberships).where(eq(memberships.accountId, account.id)).orderBy(asc(memberships.email)),
    db.select().from(invites).where(eq(invites.accountId, account.id)).orderBy(asc(invites.email)),
    db
      .select({ connectionId: comments.connectionId, n: count() })
      .from(comments)
      .where(eq(comments.accountId, account.id))
      .groupBy(comments.connectionId),
  ]);
  const storedBy = new Map(stored.map((r) => [r.connectionId, r.n]));

  return (
    <Frame ctx={ctx} active="settings" filters={null}>
      {!owner && <div className="notice">Only owners can change these settings.</div>}
      {notice && <div className="notice">{notice}</div>}
      {checked && <div className="notice">{checked}</div>}
      {problem && <div className="notice">Something went wrong: {problem}</div>}

      <section className="card">
        <h2>Business</h2>
        <form action={renameBusiness} className="inline-form">
          <input name="name" defaultValue={account.name} maxLength={120} required disabled={!owner} aria-label="Business name" />
          {owner && <button className="small">Save</button>}
        </form>
      </section>

      <section className="card">
        <h2>Connected pages</h2>
        <form action={checkNow} className="inline-form" style={{ marginTop: 0, marginBottom: 12 }}>
          <span className="lead" style={{ margin: 0, flex: 1 }}>
            New comments are fetched on a schedule, or right now with this button.
          </span>
          <button className="small">Check for new comments now</button>
        </form>
        {conns.length === 0 && <div className="empty">No pages connected yet.</div>}
        <table className="list">
          <tbody>
            {conns.map((c) => (
              <tr key={c.id}>
                <td>{PLATFORM_LABELS[c.platform]}</td>
                <td>
                  {c.displayName}
                  {c.isDemo && <span className="chip">Sample data</span>}
                </td>
                <td className="muted">
                  {storedBy.get(c.id) ?? 0} comments ·{" "}
                  {c.lastSyncedAt ? `last checked ${c.lastSyncedAt.toLocaleString("en-US")}` : "not checked yet"}
                </td>
                <td>
                  {owner && (
                    <form action={disconnect}>
                      <input type="hidden" name="id" value={c.id} />
                      <button className="small">Disconnect</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {owner && metaConfigured() && (
          <p>
            <a className="button" href="/api/connect/meta/start">
              Connect Facebook &amp; Instagram
            </a>
          </p>
        )}
        <p className="muted">
          {metaConfigured()
            ? "Sign in with a Facebook account that manages your Page. Instagram professional accounts linked to the Page are connected too. Disconnecting removes that page's comments from the dashboard."
            : "Facebook and Instagram connect here once the Meta app id and secret are added to the server settings."}
        </p>
      </section>

      <section className="card">
        <h2>Topics</h2>
        <p className="lead">
          Claude tags each comment with up to three of these, or Other. Changes apply to comments scored from now on.
        </p>
        <table className="list">
          <tbody>
            {topicRows.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td className="muted">{t.description}</td>
                <td>
                  {owner && (
                    <form action={removeTopic}>
                      <input type="hidden" name="id" value={t.id} />
                      <button className="small">Remove</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {owner && (
          <form action={addTopic} className="inline-form">
            <input name="name" placeholder="Topic name" maxLength={60} required aria-label="Topic name" />
            <input name="description" placeholder="What it covers (helps Claude)" maxLength={200} aria-label="Description" />
            <button className="small">Add topic</button>
          </form>
        )}
      </section>

      <section className="card">
        <h2>Accounts that speak for the business</h2>
        <p className="lead">
          The connected page itself is always recognised. Add the platform ids of staff or agency accounts that reply on
          the business's behalf, one per line, so their comments are left out of sentiment too.
        </p>
        <form action={saveBrandAccounts} className="stack-form">
          <textarea name="ids" rows={4} defaultValue={account.extraOwnAuthorIds.join("\n")} disabled={!owner} aria-label="Account ids" />
          {owner && <button className="small">Save</button>}
        </form>
      </section>

      <section className="card">
        <h2>Team</h2>
        <table className="list">
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td>{m.email}</td>
                <td className="muted">{m.role === "owner" ? "Owner" : "Member"}</td>
                <td>
                  {owner && m.userId !== ctx.user.id && (
                    <form action={removeMember}>
                      <input type="hidden" name="id" value={m.id} />
                      <button className="small">Remove</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {pending.map((inv) => (
              <tr key={inv.id}>
                <td>{inv.email}</td>
                <td className="muted">Invited as {inv.role === "owner" ? "owner" : "member"}</td>
                <td>
                  {owner && (
                    <form action={revokeInvite}>
                      <input type="hidden" name="id" value={inv.id} />
                      <button className="small">Cancel invite</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {owner && (
          <form action={inviteMember} className="inline-form">
            <input name="email" type="email" placeholder="name@company.com" required aria-label="Email" />
            <select name="role" defaultValue="member" aria-label="Role">
              <option value="member">Member (view and mark handled)</option>
              <option value="owner">Owner (also edit settings and team)</option>
            </select>
            <button className="small">Invite</button>
          </form>
        )}
        <p className="muted">Invited people get access the first time they sign in with that email address.</p>
      </section>
    </Frame>
  );
}
