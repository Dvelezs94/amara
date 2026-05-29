import { describe, expect, it } from "vitest";
import {
  AVAILABLE_USER_ROLES,
  canEditLockedWorkOrderChecklist,
} from "@/lib/auth-shared";

describe("AVAILABLE_USER_ROLES", () => {
  it("includes tecnico, admin and calidad", () => {
    expect(AVAILABLE_USER_ROLES).toContain("tecnico");
    expect(AVAILABLE_USER_ROLES).toContain("admin");
    expect(AVAILABLE_USER_ROLES).toContain("calidad");
    expect(AVAILABLE_USER_ROLES).toHaveLength(3);
  });
});

describe("canEditLockedWorkOrderChecklist", () => {
  it("allows admin and calidad only", () => {
    expect(canEditLockedWorkOrderChecklist("admin")).toBe(true);
    expect(canEditLockedWorkOrderChecklist("calidad")).toBe(true);
    expect(canEditLockedWorkOrderChecklist("tecnico")).toBe(false);
  });
});
