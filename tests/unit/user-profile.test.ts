import { describe, expect, it } from "vitest";
import { formatRoleLabel } from "@/lib/user-profile-labels";

describe("formatRoleLabel", () => {
  it("maps known roles to Spanish labels", () => {
    expect(formatRoleLabel("admin")).toBe("Administrador");
    expect(formatRoleLabel("tecnico")).toBe("Técnico");
    expect(formatRoleLabel("operator")).toBe("Operador");
    expect(formatRoleLabel("calidad")).toBe("Calidad");
    expect(formatRoleLabel("supervisor")).toBe("Supervisor");
  });

  it("falls back to raw role for unknown values", () => {
    expect(formatRoleLabel("custom")).toBe("custom");
  });
});
