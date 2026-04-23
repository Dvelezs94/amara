import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  API_AUTH_PUBLIC_PREFIX,
  decodeSessionRoleFromCookie,
  isOperatorApiPathAllowed,
  isOperatorAppPathAllowed,
} from "@/lib/middleware-rules";

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (path.startsWith("/uploads/")) return NextResponse.next();
  if (path === "/" || path === "/login" || path === "/solicitud")
    return NextResponse.next();
  if (path.startsWith(API_AUTH_PUBLIC_PREFIX)) return NextResponse.next();
  /** Public form: crear orden sin sesión (misma ruta sirve con sesión de operador/admin) */
  if (path === "/api/solicitud") return NextResponse.next();
  const session = req.cookies.get("session")?.value;
  if (!session) {
    const login = new URL("/login", req.url);
    login.searchParams.set("from", path);
    return NextResponse.redirect(login);
  }

  const role = decodeSessionRoleFromCookie(session);
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
    return NextResponse.redirect(new URL("/tareas", req.url));
  }

  if (role === "operator") {
    if (path.startsWith("/api/")) {
      if (isOperatorApiPathAllowed(path)) {
        return NextResponse.next();
      }
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (isOperatorAppPathAllowed(path)) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/tareas", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|icons).*)"],
};
