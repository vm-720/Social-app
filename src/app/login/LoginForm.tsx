"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowser } from "@/lib/auth/browser";

type Mode = "signin" | "signup" | "reset";

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const callback = (next: string) => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    const supabase = createSupabaseBrowser();
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace("/dashboard");
        router.refresh();
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: callback("/dashboard") },
        });
        if (error) throw error;
        setInfo("Check your email for a link to confirm your address.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: callback("/auth/reset") });
        if (error) throw error;
        setInfo("If that email has an account, a reset link is on its way.");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setError(null);
    const { error } = await createSupabaseBrowser().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback("/dashboard") },
    });
    if (error) setError(error.message);
  }

  return (
    <div className="card auth-card">
      <h2>{mode === "signin" ? "Sign in" : mode === "signup" ? "Create an account" : "Reset your password"}</h2>
      <form onSubmit={submit} className="stack-form">
        <label>
          Email
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {mode !== "reset" && (
          <label>
            Password
            <input
              type="password"
              required
              minLength={mode === "signup" ? 10 : undefined}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        )}
        {error && <div className="form-error">{error}</div>}
        {info && <div className="form-info">{info}</div>}
        <button className="primary" type="submit" disabled={busy}>
          {mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
        </button>
      </form>
      {mode !== "reset" && (
        <button className="secondary" type="button" onClick={google}>
          Continue with Google
        </button>
      )}
      <div className="auth-links">
        {mode !== "signin" && <button type="button" className="link" onClick={() => setMode("signin")}>Sign in instead</button>}
        {mode !== "signup" && <button type="button" className="link" onClick={() => setMode("signup")}>Create an account</button>}
        {mode !== "reset" && <button type="button" className="link" onClick={() => setMode("reset")}>Forgot password?</button>}
      </div>
    </div>
  );
}
