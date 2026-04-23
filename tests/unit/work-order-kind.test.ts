import { describe, expect, it } from "vitest";
import {
  parseWorkOrderKind,
  workOrderKindBadgeClass,
  workOrderKindLabel,
} from "@/lib/work-order-kind";

describe("parseWorkOrderKind", () => {
  it("maps routine", () => {
    expect(parseWorkOrderKind("routine")).toBe("routine");
  });
  it("defaults unknown to on_demand", () => {
    expect(parseWorkOrderKind(undefined)).toBe("on_demand");
    expect(parseWorkOrderKind("other")).toBe("on_demand");
  });
});

describe("workOrderKindLabel", () => {
  it("returns Spanish labels", () => {
    expect(workOrderKindLabel("routine")).toBe("Rutinaria");
    expect(workOrderKindLabel("on_demand")).toBe("Orden de trabajo");
  });
});

describe("workOrderKindBadgeClass", () => {
  it("returns routine classes", () => {
    expect(workOrderKindBadgeClass("routine")).toBe("wo-kind-routine");
    expect(workOrderKindBadgeClass("routine", true)).toBe(
      "wo-kind-routine wo-kind-emphasis"
    );
  });
  it("returns on_demand classes", () => {
    expect(workOrderKindBadgeClass("on_demand")).toBe("wo-kind-on-demand");
  });
});
