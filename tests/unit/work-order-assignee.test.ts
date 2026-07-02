import { describe, expect, it } from "vitest";
import {
  workOrderAssignedToUser,
  workOrderAssignedToUserIds,
} from "@/lib/work-order-assignee";

describe("workOrderAssignedToUser", () => {
  it("matches when user is in assigneeIds", () => {
    expect(
      workOrderAssignedToUser({ assigneeIds: ["u1", "u2"], assigneeId: "u1" }, "u2")
    ).toBe(true);
  });

  it("falls back to legacy assigneeId when assigneeIds is empty", () => {
    expect(workOrderAssignedToUser({ assigneeIds: [], assigneeId: "u1" }, "u1")).toBe(
      true
    );
    expect(workOrderAssignedToUser({ assigneeId: "u1" }, "u2")).toBe(false);
  });

  it("returns false when there are no assignees", () => {
    expect(workOrderAssignedToUser({ assigneeIds: [], assigneeId: null }, "u1")).toBe(
      false
    );
  });
});

describe("workOrderAssignedToUserIds", () => {
  it("matches junction assignees first", () => {
    expect(workOrderAssignedToUserIds(["u1", "u2"], "u9", "u2")).toBe(true);
  });

  it("falls back to legacy assignee id", () => {
    expect(workOrderAssignedToUserIds([], "u1", "u1")).toBe(true);
    expect(workOrderAssignedToUserIds([], null, "u1")).toBe(false);
  });
});
