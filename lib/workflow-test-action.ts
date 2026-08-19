import {
  buildWorkflowEvent,
  isWorkflowTriggerType,
  type WorkflowActionConfig,
  type WorkflowEvent,
  type WorkflowTriggerType,
} from "@/lib/workflows";

export const WORKFLOW_TEST_ENTITY_TYPE = "workflow_test";

export function workflowActionForDryRun(
  action: WorkflowActionConfig,
  tester: { id: string; email: string | null }
): WorkflowActionConfig {
  const email = tester.email?.trim().toLowerCase() ?? "";
  return {
    ...action,
    recipientKind: "users",
    userIds: [tester.id],
    excludeActor: false,
    emails: email ? [email] : [],
  };
}

export function buildWorkflowTestEvent(input: {
  triggerType: WorkflowTriggerType;
  tester: { id: string; name: string; email: string | null };
}): WorkflowEvent {
  return buildWorkflowEvent({
    type: input.triggerType,
    entityType: WORKFLOW_TEST_ENTITY_TYPE,
    entityId: "test",
    actorUserId: null,
    actorName: "Prueba",
    payload: {
      title: "Prueba de flujo",
      folio: "TEST",
      status: "pending",
      priority: "medium",
      assetName: "Máquina de prueba",
      note: "Esto es una prueba",
      href: "/flujos",
      contactEmail: input.tester.email,
      contactName: input.tester.name,
      requesterId: input.tester.id,
      assigneeIds: input.tester.id,
    },
  });
}

export function parseWorkflowTestTriggerType(
  value: unknown
): WorkflowTriggerType {
  return isWorkflowTriggerType(value) ? value : "work_order.created";
}
