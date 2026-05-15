import { describe, expect, it } from "vitest";
import {
  mapChecklistItemsToInsertRows,
  parseChecklistTemplateItemsFromClientJson,
} from "@/lib/checklist-items-from-payload";

describe("parseChecklistTemplateItemsFromClientJson", () => {
  it("accepts text nested under a root section", () => {
    const raw = [
      { id: "s1", type: "section", label: "Sección A" },
      {
        id: "t1",
        type: "text_block",
        label: "Texto interno",
        parentItemId: "s1",
        fieldType: "paragraph",
      },
    ];
    const { items, error } = parseChecklistTemplateItemsFromClientJson(
      raw as Array<Record<string, unknown>>
    );
    expect(error).toBeNull();
    expect(items[0].parentClientId).toBeNull();
    expect(items[1].parentClientId).toBe("s1");
  });

  it("rejects child before parent in array order", () => {
    const raw = [
      {
        id: "t1",
        type: "text_block",
        label: "x",
        parentItemId: "s1",
        fieldType: "paragraph",
      },
      { id: "s1", type: "section", label: "S" },
    ];
    const { error } = parseChecklistTemplateItemsFromClientJson(raw as Array<Record<string, unknown>>);
    expect(error).toBeTruthy();
  });

  it("maps client ids to new db ids preserving parent link", () => {
    const raw = [
      { id: "s1", type: "section", label: "S" },
      {
        id: "f1",
        type: "custom_field",
        label: "Campo",
        parentItemId: "s1",
        fieldType: "text",
        isOptional: true,
      },
    ];
    const { items, error } = parseChecklistTemplateItemsFromClientJson(
      raw as Array<Record<string, unknown>>
    );
    expect(error).toBeNull();
    expect(items[1].isOptional).toBe(true);
    const rows = mapChecklistItemsToInsertRows(items, () => "new-id");
    expect(rows).toHaveLength(2);
    expect(rows[1].parentItemId).toBe("new-id");
    expect(rows[1].isOptional).toBe(true);
  });
});
