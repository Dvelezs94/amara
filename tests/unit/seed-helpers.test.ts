import { describe, expect, it } from "vitest";
import {
  addCalendarDaysYmd,
  assignSeedChecklistItemIds,
  seedChecklistItemCompleted,
} from "@/lib/seed-helpers";

describe("addCalendarDaysYmd", () => {
  it("adds and subtracts calendar days", () => {
    expect(addCalendarDaysYmd("2026-08-18", 0)).toBe("2026-08-18");
    expect(addCalendarDaysYmd("2026-08-18", 3)).toBe("2026-08-21");
    expect(addCalendarDaysYmd("2026-08-01", -1)).toBe("2026-07-31");
  });
});

describe("assignSeedChecklistItemIds", () => {
  it("maps parentKey to the parent row id", () => {
    const rows = assignSeedChecklistItemIds(
      [
        { type: "section", label: "Seguridad", key: "sec" },
        { type: "step", label: "EPP", parentKey: "sec" },
        { type: "step", label: "Solo", key: "orphan" },
      ],
      (() => {
        let n = 0;
        return () => `id_${n++}`;
      })()
    );
    expect(rows[0]?.id).toBe("id_0");
    expect(rows[1]?.parentItemId).toBe("id_0");
    expect(rows[2]?.parentItemId).toBeNull();
  });
});

describe("seedChecklistItemCompleted", () => {
  it("marks steps complete on completed tasks and the first two on in_progress", () => {
    expect(
      seedChecklistItemCompleted({ type: "step", status: "completed", sortOrder: 5 })
    ).toBe(true);
    expect(
      seedChecklistItemCompleted({ type: "step", status: "in_progress", sortOrder: 1 })
    ).toBe(true);
    expect(
      seedChecklistItemCompleted({ type: "step", status: "in_progress", sortOrder: 2 })
    ).toBe(false);
    expect(
      seedChecklistItemCompleted({ type: "custom_field", status: "completed", sortOrder: 0 })
    ).toBe(false);
  });
});
