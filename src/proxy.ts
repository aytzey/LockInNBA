import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ORIGIN_VERIFY_SECRET = process.env.ORIGIN_VERIFY_SECRET || "";
const ORIGIN_VERIFY_HEADER = "x-lockin-origin-verify";

function isBypassedPath(pathname: string): boolean {
  return pathname === "/api/healthz";
}

export function proxy(request: NextRequest) {
  if (!ORIGIN_VERIFY_SECRET || isBypassedPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const providedSecret = request.headers.get(ORIGIN_VERIFY_HEADER);
  if (providedSecret === ORIGIN_VERIFY_SECRET) {
    return NextResponse.next();
  }

  return NextResponse.json({ message: "Forbidden" }, { status: 403 });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|lockin-logo.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)"],
};
