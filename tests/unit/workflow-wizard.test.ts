import { describe, expect, it } from "vitest";
import {
  workflowWizardAdvanceError,
  workflowWizardNextStep,
  workflowWizardPrevStep,
  workflowWizardStepLabel,
} from "@/lib/workflow-wizard";
import { defaultWorkflowAction } from "@/lib/workflows";

describe("workflow wizard steps", () => {
  it("orders Datos → Cuando → Entonces", () => {
    expect(workflowWizardStepLabel("basics")).toBe("Datos");
    expect(workflowWizardNextStep("basics")).toBe("trigger");
    expect(workflowWizardNextStep("actions")).toBeNull();
    expect(workflowWizardPrevStep("trigger")).toBe("basics");
    expect(workflowWizardPrevStep("basics")).toBeNull();
  });

  it("blocks advancing without a name or actions", () => {
    expect(
      workflowWizardAdvanceError("basics", { name: "  ", actions: [] })
    ).toBe("El nombre es obligatorio");
    expect(
      workflowWizardAdvanceError("basics", { name: "Aviso", actions: [] })
    ).toBeNull();
    expect(
      workflowWizardAdvanceError("actions", { name: "Aviso", actions: [] })
    ).toBe("Añade al menos una acción");
    expect(
      workflowWizardAdvanceError("trigger", {
        name: "Aviso",
        actions: [defaultWorkflowAction("notify")],
      })
    ).toBeNull();
  });
});
