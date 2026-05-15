import { describe, expect, it } from "vitest";
import {
  buildChecklistRevisionReviewRequestBody,
  checklistRevisionNotificationHref,
  CHECKLIST_REVISION_REVIEW_TITLE,
  parseChecklistRevisionNotificationBody,
} from "@/lib/checklist-notification-parse";

describe("checklist-notification-parse", () => {
  it("exposes stable review title", () => {
    expect(CHECKLIST_REVISION_REVIEW_TITLE).toBe("Nueva revisión de checklist");
  });

  it("builds and parses body with revision id", () => {
    const body = buildChecklistRevisionReviewRequestBody({
      templateId: "tpl1",
      revisionId: "rev1",
      templateName: "Plantilla A",
      revisionName: "1.0",
      proposedByName: "Ana",
    });
    const parsed = parseChecklistRevisionNotificationBody(body);
    expect(parsed).toEqual({
      checklistId: "tpl1",
      revisionId: "rev1",
      cleanBody: "Plantilla A · Revisión 1.0 · Ana",
    });
    expect(checklistRevisionNotificationHref(parsed!)).toBe(
      "/checklists/tpl1/revisions/rev1"
    );
  });

  it("parses legacy body without rev segment", () => {
    const body = "[checklist:abc] Solo texto";
    const parsed = parseChecklistRevisionNotificationBody(body);
    expect(parsed).toEqual({
      checklistId: "abc",
      revisionId: null,
      cleanBody: "Solo texto",
    });
    expect(checklistRevisionNotificationHref(parsed!)).toBe("/checklists/abc/revisions");
  });

  it("returns null for unrelated bodies", () => {
    expect(parseChecklistRevisionNotificationBody(null)).toBeNull();
    expect(parseChecklistRevisionNotificationBody("hello")).toBeNull();
  });
});
