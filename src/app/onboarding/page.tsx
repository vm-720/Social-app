import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { listAccess } from "@/lib/auth/context";
import { getSessionUser } from "@/lib/auth/server";
import { createBusiness } from "./actions";

export const dynamic = "force-dynamic";

export default async function Onboarding() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const existing = await listAccess(getDb(), user.id);
  return (
    <main className="auth-shell">
      <div className="card auth-card">
        <h2>Add your business</h2>
        <p className="lead">
          You can connect its social pages and adjust the topic list once it is set up. Someone already using the app
          can also invite you to their business by email.
        </p>
        <form action={createBusiness} className="stack-form">
          <label>
            Business name
            <input name="name" required maxLength={120} placeholder="Acme Coffee Roasters" />
          </label>
          <button className="primary" type="submit">
            Create business
          </button>
        </form>
        {existing.length > 0 && <a href="/dashboard">Back to the dashboard</a>}
      </div>
    </main>
  );
}
