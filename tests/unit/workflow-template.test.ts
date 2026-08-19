import { describe, expect, it } from "vitest";
import {
  WORKFLOW_TEMPLATE_VARIABLES,
  filterWorkflowTemplateVariables,
  insertWorkflowTemplateVariable,
  matchWorkflowTemplateToken,
} from "@/lib/workflow-template";

describe("matchWorkflowTemplateToken", () => {
  it("opens after a single or double brace", () => {
    expect(matchWorkflowTemplateToken("Hola {", 6)).toEqual({
      start: 5,
      end: 6,
      query: "",
    });
    expect(matchWorkflowTemplateToken("Hola {{", 7)).toEqual({
      start: 5,
      end: 7,
      query: "",
    });
  });

  it("captures a partial variable name", () => {
    expect(matchWorkflowTemplateToken("{{ti", 4)).toEqual({
      start: 0,
      end: 4,
      query: "ti",
    });
  });

  it("stays closed when there is no open brace at the cursor", () => {
    expect(matchWorkflowTemplateToken("Hola {{title}}", 14)).toBeNull();
    expect(matchWorkflowTemplateToken("sin llaves", 10)).toBeNull();
  });
});

describe("filterWorkflowTemplateVariables", () => {
  it("filters by key prefix or Spanish label", () => {
    expect(filterWorkflowTemplateVariables("").length).toBe(
      WORKFLOW_TEMPLATE_VARIABLES.length
    );
    expect(filterWorkflowTemplateVariables("ti").map((v) => v.key)).toEqual([
      "title",
    ]);
    expect(
      filterWorkflowTemplateVariables("máquina").map((v) => v.key)
    ).toEqual(["assetName"]);
  });
});

describe("insertWorkflowTemplateVariable", () => {
  it("replaces an open brace with a complete token", () => {
    expect(insertWorkflowTemplateVariable("Aviso {", 7, "title")).toEqual({
      text: "Aviso {{title}}",
      cursor: 15,
    });
    expect(insertWorkflowTemplateVariable("{{ti", 4, "title")).toEqual({
      text: "{{title}}",
      cursor: 9,
    });
  });
});
