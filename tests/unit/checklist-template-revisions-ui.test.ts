import { describe, expect, it } from "vitest";
import {
  buildInitialForDraft,
  normalizeSnapshotItems,
} from "@/lib/checklist-template-revisions-ui-helpers";

describe("normalizeSnapshotItems", () => {
  it("returns fallback for non-array", () => {
    const fb = [{ type: "step", label: "A" }];
    expect(normalizeSnapshotItems(null, fb)).toEqual(fb);
  });

  it("coerces item fields", () => {
    expect(
      normalizeSnapshotItems([
        {
          id: " i1 ",
          type: "custom_field",
          label: "Campo",
          fieldType: "text",
          options: [1, "b"],
          parentItemId: " p1 ",
          isOptional: true,
        },
      ])
    ).toEqual([
      {
        id: "i1",
        type: "custom_field",
        label: "Campo",
        fieldType: "text",
        options: ["1", "b"],
        parentItemId: "p1",
        isOptional: true,
      },
    ]);
  });
});

describe("buildInitialForDraft", () => {
  const template = {
    name: "Plantilla",
    description: "Desc",
    items: [{ type: "step", label: "Paso" }],
  };

  it("uses array draft as items", () => {
    const init = buildInitialForDraft([{ type: "step", label: "X" }], template);
    expect(init.name).toBe("Plantilla");
    expect(init.items?.[0]?.label).toBe("X");
  });

  it("merges object draft", () => {
    const init = buildInitialForDraft(
      { name: "Borrador", description: null, items: [{ type: "step", label: "Y" }] },
      template
    );
    expect(init).toEqual({
      name: "Borrador",
      description: null,
      items: [
        {
          type: "step",
          label: "Y",
          fieldType: null,
          options: null,
          parentItemId: null,
        },
      ],
    });
  });

  it("returns template for invalid draft", () => {
    expect(buildInitialForDraft(undefined, template)).toBe(template);
  });
});
