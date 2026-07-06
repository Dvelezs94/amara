import { describe, expect, it } from "vitest";
import {
  assigneeIdsToNotifyOnWorkOrderPatch,
  isWorkOrderTransitioningToCompleted,
  shouldNotifyRequesterOnWorkOrderCompletion,
} from "@/lib/work-order-completion-notifications";

describe("isWorkOrderTransitioningToCompleted", () => {
  it("true when moving from in_progress to completed", () => {
    expect(isWorkOrderTransitioningToCompleted("in_progress", "completed")).toBe(true);
  });

  it("false when already completed", () => {
    expect(isWorkOrderTransitioningToCompleted("completed", "completed")).toBe(false);
  });

  it("false for other status changes", () => {
    expect(isWorkOrderTransitioningToCompleted("pending", "in_progress")).toBe(false);
  });
});

describe("shouldNotifyRequesterOnWorkOrderCompletion", () => {
  const base = {
    previousStatus: "in_progress",
    newStatus: "completed" as const,
    requesterId: "req-1",
    completedByUserId: "tech-1",
  };

  it("notifies requester on transition to completed", () => {
    expect(shouldNotifyRequesterOnWorkOrderCompletion(base)).toBe(true);
  });

  it("skips when requesterId is null", () => {
    expect(shouldNotifyRequesterOnWorkOrderCompletion({ ...base, requesterId: null })).toBe(
      false
    );
  });

  it("skips when creator completes own task", () => {
    expect(
      shouldNotifyRequesterOnWorkOrderCompletion({
        ...base,
        completedByUserId: "req-1",
      })
    ).toBe(false);
  });

  it("skips when already completed", () => {
    expect(
      shouldNotifyRequesterOnWorkOrderCompletion({
        ...base,
        previousStatus: "completed",
      })
    ).toBe(false);
  });
});

describe("assigneeIdsToNotifyOnWorkOrderPatch", () => {
  it("excludes patch actor", () => {
    expect(
      assigneeIdsToNotifyOnWorkOrderPatch({
        assigneeIds: ["a", "b"],
        patchUserId: "a",
        requesterId: "req",
        isTransitioningToCompleted: false,
      })
    ).toEqual(["b"]);
  });

  it("excludes requester on completion transition so they get completion notification", () => {
    expect(
      assigneeIdsToNotifyOnWorkOrderPatch({
        assigneeIds: ["req", "tech"],
        patchUserId: "tech",
        requesterId: "req",
        isTransitioningToCompleted: true,
      })
    ).toEqual([]);
  });

  it("keeps requester in assignee list when not completing", () => {
    expect(
      assigneeIdsToNotifyOnWorkOrderPatch({
        assigneeIds: ["req", "tech"],
        patchUserId: "admin",
        requesterId: "req",
        isTransitioningToCompleted: false,
      })
    ).toEqual(["req", "tech"]);
  });
});
