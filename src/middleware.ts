import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { authEnabled, isPublicPath } from "@/lib/auth/config";

// Keeps the Supabase session fresh on every request and sends signed-out visitors to /login.
// Pages and actions still check membership themselves; this is only the first gate.

export async function middleware(req: NextRequest) {
  if (!authEnabled()) {
    if (process.env.NODE_ENV === "production" && !isPublicPath(req.nextUrl.pathname)) {
      return new NextResponse("Login is not configured (set the Supabase environment variables)", { status: 503 });
    }
    return NextResponse.next();
  }

  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (toSet, headers) => {
        for (const { name, value } of toSet) req.cookies.set(name, value);
        res = NextResponse.next({ request: req });
        for (const { name, value, options } of toSet) res.cookies.set(name, value, options);
        for (const [k, v] of Object.entries(headers ?? {})) res.headers.set(k, v);
      },
    },
  });
  const { data } = await supabase.auth.getUser();

  if (!data.user && !isPublicPath(req.nextUrl.pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
