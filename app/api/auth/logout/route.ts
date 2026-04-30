import { NextRequest, NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";

/** Absolute URL for `Location` after logout: root `/`, never `0.0.0.0` as host. */
function postLogoutRedirectUrl(req: NextRequest): string {
  const forwardedHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (forwardedHost) {
    const proto =
      req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? "https";
    return `${proto}://${forwardedHost}/`;
  }
  const base = new URL(req.url);
  if (base.hostname === "0.0.0.0") {
    base.hostname = "localhost";
  }
  base.pathname = "/";
  base.search = "";
  base.hash = "";
  return base.toString();
}

export async function POST(req: NextRequest) {
  await destroySession();
  return NextResponse.redirect(postLogoutRedirectUrl(req), 303);
}
