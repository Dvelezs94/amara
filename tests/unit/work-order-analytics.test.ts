import { describe, expect, it } from "vitest";
import { workOrderCountsForChecklistAnalytics } from "@/lib/work-order-analytics";
import { buildCategoricalDailyTimeData } from "@/lib/analytics-checklist-multi-chart";

describe("workOrderCountsForChecklistAnalytics", () => {
  it("only includes completed work orders with completedAt", () => {
    expect(
      workOrderCountsForChecklistAnalytics("completed", "2024-01-01T12:00:00Z")
    ).toBe(true);
    expect(workOrderCountsForChecklistAnalytics("cancelled", "2024-01-01T12:00:00Z")).toBe(
      false
    );
    expect(workOrderCountsForChecklistAnalytics("completed", null)).toBe(false);
  });
});

describe("buildCategoricalDailyTimeData", () => {
  it("skips cancelled rows even if completedAt is set", () => {
    const { data } = buildCategoricalDailyTimeData(
      [
        {
          status: "cancelled",
          completedAt: "2024-01-02T12:00:00Z",
          checklistItems: [
            {
              id: "c1",
              label: "Puerta",
              type: "custom_field",
              fieldType: "dropdown",
              value: "Óptimo",
            },
          ],
        },
        {
          status: "completed",
          completedAt: "2024-01-02T12:00:00Z",
          checklistItems: [
            {
              id: "c2",
              label: "Puerta",
              type: "custom_field",
              fieldType: "dropdown",
              value: "Óptimo",
            },
          ],
        },
      ],
      "Puerta",
      "UTC"
    );
    expect(data).toHaveLength(1);
    expect(data[0]!.d0).toBe(1);
  });
});
