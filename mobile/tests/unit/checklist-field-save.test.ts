import { describe, expect, it } from "vitest";
import { workOrderChecklistIsCompleteForClosure } from "../../lib/checklist-completion";
import {
  applyChecklistItemLocalUpdate,
  buildChecklistPatchBody,
  buildFieldValuePatch,
  buildStepCompletedPatch,
  collectChecklistDraftFlushOps,
  mergeChecklistDraftsIntoItems,
  normalizeChecklistValueForFieldType,
  parseChecklistNumberDraftValue,
  parseChecklistTextDraftValue,
} from "../../lib/checklist-field-save";

describe("parseChecklistNumberDraftValue", () => {
  it("parses empty, integers, and comma decimals", () => {
    expect(parseChecklistNumberDraftValue("")).toBeNull();
    expect(parseChecklistNumberDraftValue("  ")).toBeNull();
    expect(parseChecklistNumberDraftValue("12")).toBe(12);
    expect(parseChecklistNumberDraftValue("12,5")).toBe(12.5);
    expect(parseChecklistNumberDraftValue("abc")).toBeNull();
  });
});

describe("parseChecklistTextDraftValue", () => {
  it("keeps content but treats blank as null", () => {
    expect(parseChecklistTextDraftValue("")).toBeNull();
    expect(parseChecklistTextDraftValue("  ")).toBeNull();
    expect(parseChecklistTextDraftValue(" hola ")).toBe("hola");
  });
});

describe("buildChecklistPatchBody", () => {
  it("includes itemId and only defined keys", () => {
    expect(buildChecklistPatchBody("i1", { value: "x" })).toEqual({
      itemId: "i1",
      value: "x",
    });
    expect(buildChecklistPatchBody("i1", { completed: true })).toEqual({
      itemId: "i1",
      completed: true,
    });
    expect(buildChecklistPatchBody("i1", { value: null })).toEqual({
      itemId: "i1",
      value: null,
    });
    expect(buildChecklistPatchBody("i1", { value: 0 })).toEqual({
      itemId: "i1",
      value: 0,
    });
  });
});

describe("field-type payload builders", () => {
  it("builds step completed patch", () => {
    expect(buildStepCompletedPatch(true)).toEqual({ completed: true });
  });

  it("normalizes every custom field type for the API payload", () => {
    expect(buildFieldValuePatch("text", "hola").value).toBe("hola");
    expect(buildFieldValuePatch("text", "  ").value).toBeNull();
    expect(buildFieldValuePatch("number", "3,5").value).toBe(3.5);
    expect(buildFieldValuePatch("number", "").value).toBeNull();
    expect(buildFieldValuePatch("date", "2026-07-30").value).toBe("2026-07-30");
    expect(buildFieldValuePatch("dropdown", "A").value).toBe("A");
    expect(buildFieldValuePatch("checkbox", true).value).toBe(true);
    expect(buildFieldValuePatch("checkbox", null).value).toBeNull();
    expect(buildFieldValuePatch("photo", "/api/x").value).toEqual(["/api/x"]);
    expect(buildFieldValuePatch("photo", ["/a", "", "/b"]).value).toEqual(["/a", "/b"]);
  });
});

describe("applyChecklistItemLocalUpdate", () => {
  it("updates only the target item", () => {
    const items = [
      { id: "a", type: "custom_field", fieldType: "text", value: null },
      { id: "b", type: "step", fieldType: null, value: null, completed: false },
    ];
    const next = applyChecklistItemLocalUpdate(items, "a", { value: "ok" });
    expect(next[0]!.value).toBe("ok");
    expect(next[1]).toEqual(items[1]);
  });
});

describe("mergeChecklistDraftsIntoItems + flush ops", () => {
  it("merges drafts so completeness sees unsaved UI values", () => {
    const items = [
      { id: "n1", type: "custom_field", fieldType: "number", value: null as unknown },
      { id: "t1", type: "custom_field", fieldType: "text", value: null as unknown },
    ];
    const merged = mergeChecklistDraftsIntoItems(
      items,
      { n1: "42" },
      { t1: "nota" }
    );
    expect(merged[0]!.value).toBe(42);
    expect(merged[1]!.value).toBe("nota");
  });

  it("collects flush ops for all pending drafts", () => {
    const ops = collectChecklistDraftFlushOps({ n1: "1,5" }, { t1: "x", t2: "  " });
    expect(ops).toEqual(
      expect.arrayContaining([
        { itemId: "n1", value: 1.5 },
        { itemId: "t1", value: "x" },
        { itemId: "t2", value: null },
      ])
    );
    expect(ops).toHaveLength(3);
  });

  it("complete when all field types are filled via patch payloads", () => {
    const items = [
      { type: "step", completed: true, fieldType: null, value: null },
      {
        type: "custom_field",
        fieldType: "text",
        value: buildFieldValuePatch("text", "  nota  ").value,
        isOptional: false,
      },
      {
        type: "custom_field",
        fieldType: "number",
        value: buildFieldValuePatch("number", "10").value,
        isOptional: false,
      },
      {
        type: "custom_field",
        fieldType: "date",
        value: buildFieldValuePatch("date", "2026-07-30").value,
        isOptional: false,
      },
      {
        type: "custom_field",
        fieldType: "dropdown",
        value: buildFieldValuePatch("dropdown", "Media").value,
        isOptional: false,
      },
      {
        type: "custom_field",
        fieldType: "checkbox",
        value: buildFieldValuePatch("checkbox", false).value,
        isOptional: false,
      },
      {
        type: "custom_field",
        fieldType: "photo",
        value: buildFieldValuePatch("photo", ["/api/wo/a"]).value,
        isOptional: false,
      },
    ];
    // Ensure completeness + JSON-serializable PATCH bodies for every field type.
    expect(workOrderChecklistIsCompleteForClosure(items)).toBe(true);
    for (const item of items) {
      if (item.type !== "custom_field") continue;
      const body = buildChecklistPatchBody("id", { value: item.value });
      expect(body).toHaveProperty("itemId", "id");
      expect(body).toHaveProperty("value");
      expect(JSON.parse(JSON.stringify(body)).value).toEqual(item.value);
    }
  });
});

describe("normalizeChecklistValueForFieldType", () => {
  it("defaults unknown/missing fieldType to text-like", () => {
    expect(normalizeChecklistValueForFieldType(undefined, "a")).toBe("a");
    expect(normalizeChecklistValueForFieldType(null, "")).toBeNull();
  });
});
