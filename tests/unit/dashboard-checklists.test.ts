import { describe, expect, it } from "vitest";
import {
  checklistDropdownValueIsNoOk,
  countChecklistProgress,
  dayBoundsInAppTimeZone,
  groupChecklistsByWorkOrder,
  isChecklistPriority,
  shiftYmd,
  todayYmdInAppTimeZone,
} from "@/lib/dashboard-checklists";

describe("isChecklistPriority", () => {
  it("returns true when work order has notes", () => {
    expect(isChecklistPriority([], true)).toBe(true);
  });

  it("returns true for dropdown NO OK value", () => {
    expect(
      isChecklistPriority(
        [{ type: "custom_field", fieldType: "dropdown", value: "NO OK" }],
        false
      )
    ).toBe(true);
  });

  it("returns false for dropdown OK value without notes", () => {
    expect(
      isChecklistPriority(
        [{ type: "custom_field", fieldType: "dropdown", value: "OK" }],
        false
      )
    ).toBe(false);
  });

  it("ignores non-dropdown fields for NO OK detection", () => {
    expect(
      isChecklistPriority(
        [{ type: "custom_field", fieldType: "text", value: "NO OK en texto" }],
        false
      )
    ).toBe(false);
  });
});

describe("checklistDropdownValueIsNoOk", () => {
  it("matches case-insensitive variants", () => {
    expect(checklistDropdownValueIsNoOk("no ok")).toBe(true);
    expect(checklistDropdownValueIsNoOk("No Ok")).toBe(true);
    expect(checklistDropdownValueIsNoOk("OK")).toBe(false);
  });
});

describe("countChecklistProgress", () => {
  it("counts steps and custom fields", () => {
    const result = countChecklistProgress([
      { type: "step", completed: true, value: null },
      { type: "step", completed: false, value: null },
      { type: "custom_field", fieldType: "text", value: "listo", completed: false },
      { type: "section", completed: false, value: null },
    ]);
    expect(result).toEqual({ completedCount: 2, totalCount: 3 });
  });
});

describe("groupChecklistsByWorkOrder", () => {
  it("groups rows and computes priority + progress", () => {
    const groups = groupChecklistsByWorkOrder(
      [
        {
          workOrderId: "wo-1",
          checklistTemplateId: "tpl-1",
          type: "step",
          completed: true,
          value: null,
        },
        {
          workOrderId: "wo-1",
          checklistTemplateId: "tpl-1",
          type: "custom_field",
          fieldType: "dropdown",
          value: "NO OK",
          completed: false,
        },
        {
          workOrderId: "wo-2",
          checklistTemplateId: "tpl-2",
          type: "step",
          completed: false,
          value: null,
        },
      ],
      { "wo-2": true }
    );

    expect(groups).toHaveLength(2);
    const wo1 = groups.find((g) => g.workOrderId === "wo-1");
    const wo2 = groups.find((g) => g.workOrderId === "wo-2");
    expect(wo1).toMatchObject({
      checklistTemplateId: "tpl-1",
      completedCount: 2,
      totalCount: 2,
      isPriority: true,
    });
    expect(wo2).toMatchObject({
      checklistTemplateId: "tpl-2",
      completedCount: 0,
      totalCount: 1,
      isPriority: true,
    });
  });
});

describe("dayBoundsInAppTimeZone", () => {
  it("returns start before end for a valid day", () => {
    const bounds = dayBoundsInAppTimeZone("2026-09-03");
    expect(bounds).not.toBeNull();
    expect(bounds!.end.getTime()).toBeGreaterThan(bounds!.start.getTime());
  });

  it("shiftYmd moves one day", () => {
    expect(shiftYmd("2026-09-03", 1)).toBe("2026-09-04");
    expect(shiftYmd("2026-09-03", -1)).toBe("2026-09-02");
  });

  it("todayYmdInAppTimeZone returns YYYY-MM-DD", () => {
    expect(todayYmdInAppTimeZone(new Date("2026-09-03T18:00:00Z"))).toMatch(
      /^\d{4}-\d{2}-\d{2}$/
    );
  });
});
