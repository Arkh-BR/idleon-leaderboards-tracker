// web/middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { PROTEST_MODE } from "@/lib/protest/config";

export function middleware(req: NextRequest) {
  if (!PROTEST_MODE) return NextResponse.next();

  // Don't redirect the protest page onto itself (infinite loop).
  if (req.nextUrl.pathname.startsWith("/protest")) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/protest";
  // 307 (temporary) so search engines keep the original URLs as canonical.
  return NextResponse.redirect(url, 307);
}

export const config = {
  // Run on everything except Next internals, Vercel internals, the favicon,
  // and any file with an extension (static assets) — so the protest page keeps
  // its styles and analytics keep working.
  matcher: ["/((?!_next/|_vercel/|favicon.ico|.*\\.).*)"],
};
