"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowser } from "@/lib/auth/browser";

export default function ResetPassword() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await createSupabaseBrowser().auth.updateUser({ password });
    if (error) setError(error.message);
    else router.replace("/dashboard");
  }

  return (
    <main className="auth-shell">
      <div className="card auth-card">
        <h2>Choose a new password</h2>
        <form onSubmit={submit} className="stack-form">
          <label>
            New password
            <input type="password" required minLength={10} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error && <div className="form-error">{error}</div>}
          <button className="primary" type="submit">
            Save password
          </button>
        </form>
      </div>
    </main>
  );
}
