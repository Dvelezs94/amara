import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const apiPublicPrefix = "/api/auth/";
const operatorAllowedAppPrefixes = ["/work-orders", "/knowledge-base", "/profile"];
const operatorAllowedApiPrefixes = [
  "/api/work-orders",
  "/api/knowledge-base",
  "/api/asset-files",
  "/api/users/me/avatar",
  "/api/users",
  "/api/assets",
  "/api/checklist-templates",
  "/api/notifications",
];

function decodeSessionRole(token: string): string | null {
  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return null;
    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "="
    );
    const payload = JSON.parse(atob(padded)) as { role?: unknown };
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

function isAllowedPrefix(path: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (path === "/" || path === "/login" || path === "/solicitud")
    return NextResponse.next();
  if (path.startsWith(apiPublicPrefix)) return NextResponse.next();
  const session = req.cookies.get("session")?.value;
  if (!session) {
    const login = new URL("/login", req.url);
    login.searchParams.set("from", path);
    return NextResponse.redirect(login);
  }

  const role = decodeSessionRole(session);
  if (!role) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const login = new URL("/login", req.url);
    login.searchParams.set("from", path);
    return NextResponse.redirect(login);
  }

  if (role !== "admin" && role !== "operator") {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/work-orders", req.url));
  }

  if (role === "operator") {
    if (path.startsWith("/api/")) {
      if (
        path.startsWith(apiPublicPrefix) ||
        isAllowedPrefix(path, operatorAllowedApiPrefixes)
      ) {
        return NextResponse.next();
      }
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (isAllowedPrefix(path, operatorAllowedAppPrefixes)) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/work-orders", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|icons).*)"],
};
