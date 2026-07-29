import { describe, expect, it } from "vitest";
import { dedupeAssigneeIds } from "@/lib/assignee-ids";
import {
  computeNextWorkOrderFolio,
  INITIAL_WORK_ORDER_FOLIO,
} from "@/lib/work-order-folio-helpers";
import { APP_TIME_ZONE } from "@/lib/timezone";
import { formatRoleLabel } from "@/lib/user-profile-labels";

describe("dedupeAssigneeIds", () => {
  it("removes empties and duplicates preserving order", () => {
    expect(dedupeAssigneeIds(["a", "", "b", "a", "c"])).toEqual(["a", "b", "c"]);
  });
});

describe("computeNextWorkOrderFolio", () => {
  it("starts at initial when empty", () => {
    expect(computeNextWorkOrderFolio(null)).toBe(INITIAL_WORK_ORDER_FOLIO);
    expect(computeNextWorkOrderFolio(0)).toBe(INITIAL_WORK_ORDER_FOLIO);
  });
  it("increments above initial", () => {
    expect(computeNextWorkOrderFolio(2005)).toBe(2006);
  });
});

describe("APP_TIME_ZONE", () => {
  it("is Saltillo/Monterrey zone", () => {
    expect(APP_TIME_ZONE).toBe("America/Monterrey");
  });
});

describe("formatRoleLabel", () => {
  it("maps known roles", () => {
    expect(formatRoleLabel("admin")).toBe("Administrador");
    expect(formatRoleLabel("tecnico")).toBe("Técnico");
    expect(formatRoleLabel("calidad")).toBe("Calidad");
  });
  it("returns raw for unknown", () => {
    expect(formatRoleLabel("other")).toBe("other");
  });
});
