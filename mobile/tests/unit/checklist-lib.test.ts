import { describe, expect, it } from "vitest";
import {
  checklistItemBlocksWorkOrderCompletion,
  workOrderChecklistIsCompleteForClosure,
} from "../../lib/checklist-completion";
import {
  flattenChecklistTreeForDisplay,
  checklistItemDepth,
} from "../../lib/checklist-item-tree";
import {
  CHECKLIST_REVISION_REVIEW_TITLE,
  parseChecklistRevisionNotificationBody,
} from "../../lib/checklist-notification-parse";

describe("mobile checklist-completion mirrors web rules", () => {
  it("blocks incomplete step", () => {
    expect(
      checklistItemBlocksWorkOrderCompletion({
        type: "step",
        completed: false,
        fieldType: null,
        value: null,
      })
    ).toBe(true);
  });
  it("complete checklist closes", () => {
    expect(
      workOrderChecklistIsCompleteForClosure([
        { type: "step", completed: true, fieldType: null, value: null },
      ])
    ).toBe(true);
  });
});

describe("mobile checklist-item-tree", () => {
  it("flattens and reports depth", () => {
    const all = [
      { id: "s1", parentItemId: null, sortOrder: 0, type: "section", label: "Sec" },
      { id: "i1", parentItemId: "s1", sortOrder: 0, type: "step", label: "Paso" },
    ];
    const flat = flattenChecklistTreeForDisplay(all);
    expect(flat.map((x) => x.id)).toEqual(["s1", "i1"]);
    expect(checklistItemDepth(flat[1]!, all)).toBe(1);
  });
});

describe("mobile checklist-notification-parse", () => {
  it("keeps revision title constant", () => {
    expect(CHECKLIST_REVISION_REVIEW_TITLE).toContain("checklist");
  });
  it("parses revision body", () => {
    const parsed = parseChecklistRevisionNotificationBody(
      "[checklist:t1][rev:r1] Plantilla · Revisión A"
    );
    expect(parsed).toEqual({
      checklistId: "t1",
      revisionId: "r1",
      cleanBody: "Plantilla · Revisión A",
    });
  });
  it("returns null for plain text", () => {
    expect(parseChecklistRevisionNotificationBody("texto simple")).toBeNull();
  });
});
