import { describe, expect, it } from "vitest";
import {
  canAuthorEditChecklistRevision,
  resolveRevisionSaveStatus,
} from "@/lib/checklist-revision-save";

describe("resolveRevisionSaveStatus", () => {
  it("keeps proposed when saving an in-review revision", () => {
    expect(resolveRevisionSaveStatus("save", "proposed")).toBe("proposed");
  });

  it("keeps draft when saving a draft revision", () => {
    expect(resolveRevisionSaveStatus("save", "draft")).toBe("draft");
  });

  it("creates draft when saving a new revision", () => {
    expect(resolveRevisionSaveStatus("save", null)).toBe("draft");
  });

  it("submits to proposed regardless of existing status", () => {
    expect(resolveRevisionSaveStatus("submit_review", "draft")).toBe("proposed");
    expect(resolveRevisionSaveStatus("submit_review", "proposed")).toBe("proposed");
    expect(resolveRevisionSaveStatus("submit_review", null)).toBe("proposed");
  });
});

describe("canAuthorEditChecklistRevision", () => {
  it("allows draft and proposed for the author", () => {
    expect(
      canAuthorEditChecklistRevision({
        status: "draft",
        proposedByUserId: "u1",
        sessionId: "u1",
      })
    ).toBe(true);
    expect(
      canAuthorEditChecklistRevision({
        status: "proposed",
        proposedByUserId: "u1",
        sessionId: "u1",
      })
    ).toBe(true);
  });

  it("denies other users and terminal statuses", () => {
    expect(
      canAuthorEditChecklistRevision({
        status: "proposed",
        proposedByUserId: "u1",
        sessionId: "u2",
      })
    ).toBe(false);
    expect(
      canAuthorEditChecklistRevision({
        status: "approved",
        proposedByUserId: "u1",
        sessionId: "u1",
      })
    ).toBe(false);
  });
});
