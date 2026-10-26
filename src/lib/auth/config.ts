export interface SessionUser {
  id: string;
  email: string;
}

/** Login is on when the Supabase project is configured. */
export function authEnabled() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** Without Supabase, local development runs as this single user. Never used in production. */
export const DEV_USER: SessionUser = { id: "dev-user", email: "dev@localhost" };

export const PUBLIC_PATHS = ["/login", "/auth/", "/api/cron/"];

export function isPublicPath(pathname: string) {
  // Entries ending in "/" cover everything under them; others must match exactly.
  return PUBLIC_PATHS.some((p) => (p.endsWith("/") ? pathname.startsWith(p) : pathname === p));
}
