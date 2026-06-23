import { describe, expect, it } from "vitest";
import { canDeleteChecklistRevision } from "@/lib/checklist-revision-delete";

const rev = (status: string, proposedByUserId = "u1") => ({
  id: "rev-1",
  status,
  proposedByUserId,
});

describe("canDeleteChecklistRevision", () => {
  it("blocks calidad", () => {
    expect(canDeleteChecklistRevision("calidad", "u1", rev("rejected"))).toBe(false);
  });

  it("allows admin to delete approved revisions", () => {
    expect(canDeleteChecklistRevision("admin", "u2", rev("approved", "u1"))).toBe(true);
  });

  it("allows author to delete own draft", () => {
    expect(canDeleteChecklistRevision("tecnico", "u1", rev("draft"))).toBe(true);
  });

  it("blocks tecnico from deleting others revisions", () => {
    expect(canDeleteChecklistRevision("tecnico", "u2", rev("draft", "u1"))).toBe(false);
  });

  it("blocks tecnico from deleting approved history", () => {
    expect(canDeleteChecklistRevision("tecnico", "u1", rev("approved"))).toBe(false);
  });

  it("blocks virtual baseline row", () => {
    expect(
      canDeleteChecklistRevision("admin", "u1", {
        id: "revision-0-virtual",
        status: "approved",
        proposedByUserId: null,
      })
    ).toBe(false);
  });
});
