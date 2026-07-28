import { describe, expect, it } from "vitest";
import {
  decodeSessionRoleFromCookie,
  isTecnicoApiPathAllowed,
  isTecnicoAppPathAllowed,
  isPathUnderAnyPrefix,
  isCalidadApiPathAllowed,
  isCalidadAppPathAllowed,
} from "@/lib/middleware-rules";

function makeSessionCookie(role: string) {
  const payload = Buffer.from(JSON.stringify({ role, sub: "user1" })).toString(
    "base64url"
  );
  return `hdr.${payload}.sig`;
}

describe("decodeSessionRoleFromCookie", () => {
  it("reads role from JWT-shaped cookie", () => {
    expect(decodeSessionRoleFromCookie(makeSessionCookie("tecnico"))).toBe(
      "tecnico"
    );
    expect(decodeSessionRoleFromCookie(makeSessionCookie("operator"))).toBe(
      "operator"
    );
    expect(decodeSessionRoleFromCookie(makeSessionCookie("admin"))).toBe("admin");
    expect(decodeSessionRoleFromCookie(makeSessionCookie("calidad"))).toBe(
      "calidad"
    );
    expect(decodeSessionRoleFromCookie(makeSessionCookie("supervisor"))).toBe(
      "supervisor"
    );
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

describe("isTecnicoApiPathAllowed", () => {
  it("allows auth and whitelisted APIs", () => {
    expect(isTecnicoApiPathAllowed("/api/auth/login")).toBe(true);
    expect(isTecnicoApiPathAllowed("/api/work-orders")).toBe(true);
    expect(isTecnicoApiPathAllowed("/api/work-orders/wo-1")).toBe(true);
    expect(isTecnicoApiPathAllowed("/api/assets")).toBe(true);
    expect(isTecnicoApiPathAllowed("/api/asset-groups")).toBe(true);
  });
  it("blocks non-whitelisted APIs", () => {
    expect(isTecnicoApiPathAllowed("/api/admin/users")).toBe(false);
    expect(isTecnicoApiPathAllowed("/api/dashboard/overview")).toBe(false);
  });
});

describe("isTecnicoAppPathAllowed", () => {
  it("allows tecnico app sections", () => {
    expect(isTecnicoAppPathAllowed("/tareas")).toBe(true);
    expect(isTecnicoAppPathAllowed("/tareas/x")).toBe(true);
    expect(isTecnicoAppPathAllowed("/knowledge-base")).toBe(true);
    expect(isTecnicoAppPathAllowed("/equipo/user1")).toBe(true);
  });
  it("blocks admin-only sections", () => {
    expect(isTecnicoAppPathAllowed("/calendario")).toBe(false);
    expect(isTecnicoAppPathAllowed("/assets")).toBe(false);
  });
});

describe("isCalidad*PathAllowed", () => {
  it("allows calidad checklist app and api paths", () => {
    expect(isCalidadAppPathAllowed("/checklists")).toBe(true);
    expect(isCalidadAppPathAllowed("/checklists/abc")).toBe(true);
    expect(isCalidadAppPathAllowed("/tareas")).toBe(true);
    expect(isCalidadAppPathAllowed("/tareas/abc")).toBe(true);
    expect(isCalidadAppPathAllowed("/equipo/user1")).toBe(true);
    expect(isCalidadApiPathAllowed("/api/checklist-templates")).toBe(true);
    expect(isCalidadApiPathAllowed("/api/checklist-folders")).toBe(true);
    expect(isCalidadApiPathAllowed("/api/asset-groups")).toBe(true);
    expect(isCalidadApiPathAllowed("/api/checklist-templates/abc/revisions")).toBe(
      true
    );
    expect(isCalidadApiPathAllowed("/api/work-orders")).toBe(true);
  });

  it("blocks non-whitelisted calidad paths", () => {
    expect(isCalidadAppPathAllowed("/calendario")).toBe(false);
    expect(isCalidadAppPathAllowed("/assets")).toBe(false);
    expect(isCalidadApiPathAllowed("/api/admin/users")).toBe(false);
    expect(isCalidadApiPathAllowed("/api/dashboard/overview")).toBe(false);
  });
});
