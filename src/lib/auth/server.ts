import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { authEnabled, DEV_USER, type SessionUser } from "./config";

export async function createSupabaseServer() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (toSet) => {
        // Server components cannot set cookies; the middleware refreshes the session instead.
        try {
          for (const { name, value, options } of toSet) store.set(name, value, options);
        } catch {}
      },
    },
  });
}

/** The signed-in user, verified with Supabase, or null. */
export async function getSessionUser(): Promise<SessionUser | null> {
  if (!authEnabled()) {
    if (process.env.NODE_ENV === "production") return null;
    return DEV_USER;
  }
  const supabase = await createSupabaseServer();
  const { data } = await supabase.auth.getUser();
  const u = data.user;
  // Only a confirmed email may claim invites or show up on a team list.
  if (!u?.email || !u.email_confirmed_at) return null;
  return { id: u.id, email: u.email.toLowerCase() };
}
