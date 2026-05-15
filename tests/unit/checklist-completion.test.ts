import { describe, expect, it } from "vitest";
import {
  checklistItemBlocksWorkOrderCompletion,
  workOrderChecklistIsCompleteForClosure,
} from "@/lib/checklist-completion";

describe("checklistItemBlocksWorkOrderCompletion", () => {
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

  it("required text empty blocks", () => {
    expect(
      checklistItemBlocksWorkOrderCompletion({
        type: "custom_field",
        fieldType: "text",
        value: "",
        isOptional: false,
      })
    ).toBe(true);
  });

  it("optional text empty does not block", () => {
    expect(
      checklistItemBlocksWorkOrderCompletion({
        type: "custom_field",
        fieldType: "text",
        value: null,
        isOptional: true,
      })
    ).toBe(false);
  });

  it("optional photo empty does not block", () => {
    expect(
      checklistItemBlocksWorkOrderCompletion({
        type: "custom_field",
        fieldType: "photo",
        value: null,
        isOptional: true,
      })
    ).toBe(false);
  });

  it("required checkbox non-boolean blocks", () => {
    expect(
      checklistItemBlocksWorkOrderCompletion({
        type: "custom_field",
        fieldType: "checkbox",
        value: null,
        isOptional: false,
      })
    ).toBe(true);
  });

  it("optional checkbox null does not block", () => {
    expect(
      checklistItemBlocksWorkOrderCompletion({
        type: "custom_field",
        fieldType: "checkbox",
        value: null,
        isOptional: true,
      })
    ).toBe(false);
  });

  it("optional checkbox invalid type blocks", () => {
    expect(
      checklistItemBlocksWorkOrderCompletion({
        type: "custom_field",
        fieldType: "checkbox",
        value: "maybe",
        isOptional: true,
      })
    ).toBe(true);
  });
});

describe("workOrderChecklistIsCompleteForClosure", () => {
  it("returns true when optional field blank", () => {
    expect(
      workOrderChecklistIsCompleteForClosure([
        { type: "step", completed: true, fieldType: null, value: null },
        {
          type: "custom_field",
          fieldType: "text",
          value: null,
          isOptional: true,
        },
      ])
    ).toBe(true);
  });
});
