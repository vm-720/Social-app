import { redirect } from "next/navigation";
import { authEnabled } from "@/lib/auth/config";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  if (!authEnabled()) redirect("/dashboard");
  return (
    <main className="auth-shell">
      <h1>Social Sentiment</h1>
      <p className="lead">See what people say about your business across social media.</p>
      <LoginForm />
    </main>
  );
}
