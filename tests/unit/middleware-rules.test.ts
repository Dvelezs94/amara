import { describe, expect, it } from "vitest";
import {
  decodeSessionRoleFromCookie,
  isOperatorApiPathAllowed,
  isOperatorAppPathAllowed,
  isPathUnderAnyPrefix,
} from "@/lib/middleware-rules";

function makeSessionCookie(role: string) {
  const payload = Buffer.from(JSON.stringify({ role, sub: "user1" })).toString(
    "base64url"
  );
  return `hdr.${payload}.sig`;
}

describe("decodeSessionRoleFromCookie", () => {
  it("reads role from JWT-shaped cookie", () => {
    expect(decodeSessionRoleFromCookie(makeSessionCookie("operator"))).toBe(
      "operator"
    );
    expect(decodeSessionRoleFromCookie(makeSessionCookie("admin"))).toBe("admin");
  });
  it("returns null for malformed token", () => {
    expect(decodeSessionRoleFromCookie("")).toBeNull();
    expect(decodeSessionRoleFromCookie("onlyonepart")).toBeNull();
  });
});

describe("isPathUnderAnyPrefix", () => {
  it("matches exact and children", () => {
    const p = ["/tareas", "/other"] as const;
    expect(isPathUnderAnyPrefix("/tareas", p)).toBe(true);
    expect(isPathUnderAnyPrefix("/tareas/123", p)).toBe(true);
    expect(isPathUnderAnyPrefix("/calendario", p)).toBe(false);
  });
});

describe("isOperatorApiPathAllowed", () => {
  it("allows auth and whitelisted APIs", () => {
    expect(isOperatorApiPathAllowed("/api/auth/login")).toBe(true);
    expect(isOperatorApiPathAllowed("/api/work-orders")).toBe(true);
    expect(isOperatorApiPathAllowed("/api/work-orders/wo-1")).toBe(true);
    expect(isOperatorApiPathAllowed("/api/assets")).toBe(true);
  });
  it("blocks non-whitelisted APIs", () => {
    expect(isOperatorApiPathAllowed("/api/admin/users")).toBe(false);
    expect(isOperatorApiPathAllowed("/api/dashboard/overview")).toBe(false);
  });
});

describe("isOperatorAppPathAllowed", () => {
  it("allows operator app sections", () => {
    expect(isOperatorAppPathAllowed("/tareas")).toBe(true);
    expect(isOperatorAppPathAllowed("/tareas/x")).toBe(true);
    expect(isOperatorAppPathAllowed("/knowledge-base")).toBe(true);
  });
  it("blocks admin-only sections", () => {
    expect(isOperatorAppPathAllowed("/calendario")).toBe(false);
    expect(isOperatorAppPathAllowed("/assets")).toBe(false);
  });
});
