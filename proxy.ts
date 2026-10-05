import { NextResponse, type NextRequest } from "next/server";

/**
 * Spanish lives at /es/... so search engines can index it separately.
 * /es and /es/house-rules render the same pages as / and /house-rules, in Spanish.
 * The path tells the page which language to use (x-lang header) and the
 * visitor's choice is remembered in the lang cookie.
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/es" || pathname.startsWith("/es/")) {
    const url = req.nextUrl.clone();
    url.pathname = pathname === "/es" ? "/" : pathname.slice(3);
    const headers = new Headers(req.headers);
    headers.set("x-lang", "es");
    const res = NextResponse.rewrite(url, { request: { headers } });
    res.cookies.set("lang", "es", { path: "/", maxAge: 31536000, sameSite: "lax" });
    return res;
  }
  // Ignore any x-lang a client tries to send on other paths.
  if (req.headers.has("x-lang")) {
    const headers = new Headers(req.headers);
    headers.delete("x-lang");
    return NextResponse.next({ request: { headers } });
  }
  return NextResponse.next();
}

export const config = {
  // Public pages only; APIs, admin and static files don't need it.
  matcher: ["/((?!api|admin|_next|calendar|photos|.*\\..*).*)"],
};
