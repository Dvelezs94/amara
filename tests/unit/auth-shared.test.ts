import { describe, expect, it } from "vitest";
import { AVAILABLE_USER_ROLES } from "@/lib/auth-shared";

describe("AVAILABLE_USER_ROLES", () => {
  it("includes operator and admin", () => {
    expect(AVAILABLE_USER_ROLES).toContain("operator");
    expect(AVAILABLE_USER_ROLES).toContain("admin");
    expect(AVAILABLE_USER_ROLES).toHaveLength(2);
  });
});
