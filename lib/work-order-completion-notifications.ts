export function isWorkOrderTransitioningToCompleted(
  previousStatus: string,
  newStatus: string | undefined
): boolean {
  return previousStatus !== "completed" && newStatus === "completed";
}

export function shouldNotifyRequesterOnWorkOrderCompletion(input: {
  previousStatus: string;
  newStatus: string | undefined;
  requesterId: string | null;
  completedByUserId: string;
}): boolean {
  if (!isWorkOrderTransitioningToCompleted(input.previousStatus, input.newStatus)) {
    return false;
  }
  if (!input.requesterId) return false;
  if (input.requesterId === input.completedByUserId) return false;
  return true;
}

/** Assignees who should receive the generic work_order_update on a non-assignee PATCH. */
export function assigneeIdsToNotifyOnWorkOrderPatch(input: {
  assigneeIds: string[];
  patchUserId: string;
  requesterId: string | null;
  isTransitioningToCompleted: boolean;
}): string[] {
  return input.assigneeIds.filter((id) => {
    if (id === input.patchUserId) return false;
    if (input.isTransitioningToCompleted && input.requesterId && id === input.requesterId) {
      return false;
    }
    return true;
  });
}

export const WORK_ORDER_COMPLETED_NOTIFICATION_TITLE = "Tarea completada";
