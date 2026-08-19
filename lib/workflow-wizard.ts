import type { WorkflowActionConfig } from "@/lib/workflows";

export const WORKFLOW_WIZARD_STEPS = ["basics", "trigger", "actions"] as const;
export type WorkflowWizardStep = (typeof WORKFLOW_WIZARD_STEPS)[number];

export function workflowWizardStepIndex(step: WorkflowWizardStep): number {
  return WORKFLOW_WIZARD_STEPS.indexOf(step);
}

export function workflowWizardStepLabel(step: WorkflowWizardStep): string {
  switch (step) {
    case "basics":
      return "Datos";
    case "trigger":
      return "Cuando";
    case "actions":
      return "Entonces";
  }
}

export function workflowWizardNextStep(
  step: WorkflowWizardStep
): WorkflowWizardStep | null {
  const index = workflowWizardStepIndex(step);
  return WORKFLOW_WIZARD_STEPS[index + 1] ?? null;
}

export function workflowWizardPrevStep(
  step: WorkflowWizardStep
): WorkflowWizardStep | null {
  const index = workflowWizardStepIndex(step);
  return index > 0 ? WORKFLOW_WIZARD_STEPS[index - 1] : null;
}

export function workflowWizardAdvanceError(
  step: WorkflowWizardStep,
  draft: { name: string; actions: WorkflowActionConfig[] }
): string | null {
  if (step === "basics") {
    const name = draft.name.trim();
    if (!name) return "El nombre es obligatorio";
    if (name.length > 120) return "El nombre es demasiado largo";
    return null;
  }
  if (step === "actions" && draft.actions.length === 0) {
    return "Añade al menos una acción";
  }
  return null;
}
