import { NextResponse, type NextRequest } from "next/server";

// Interim protection until real user login lands: one shared password (HTTP Basic auth)
// in front of every page. In production the app refuses to serve without APP_PASSWORD.

function unauthorized() {
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Social Sentiment"' },
  });
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function middleware(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) {
    if (process.env.NODE_ENV === "production") {
      return new NextResponse("APP_PASSWORD is not set", { status: 503 });
    }
    return NextResponse.next();
  }
  const header = req.headers.get("authorization") ?? "";
  const [scheme, encoded] = header.split(" ");
  if (scheme !== "Basic" || !encoded) return unauthorized();
  const decoded = atob(encoded);
  const supplied = decoded.slice(decoded.indexOf(":") + 1);
  return safeEqual(supplied, password) ? NextResponse.next() : unauthorized();
}

export const config = {
  // The cron route checks its own secret.
  matcher: ["/((?!api/cron|_next/static|_next/image|favicon.ico).*)"],
};
