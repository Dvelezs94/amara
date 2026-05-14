import { describe, expect, it } from "vitest";
import { AVAILABLE_USER_ROLES } from "@/lib/auth-shared";

describe("AVAILABLE_USER_ROLES", () => {
  it("includes tecnico, admin and calidad", () => {
    expect(AVAILABLE_USER_ROLES).toContain("tecnico");
    expect(AVAILABLE_USER_ROLES).toContain("admin");
    expect(AVAILABLE_USER_ROLES).toContain("calidad");
    expect(AVAILABLE_USER_ROLES).toHaveLength(3);
  });
});
