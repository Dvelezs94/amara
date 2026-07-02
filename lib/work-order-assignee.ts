/** Work order assignee fields from list/detail payloads or loaded assignee rows. */
export type WorkOrderAssigneeRef = {
  assigneeId?: string | null;
  assigneeIds?: string[];
};

/** True when `userId` is among assignees (junction table or legacy primary assignee). */
export function workOrderAssignedToUser(
  wo: WorkOrderAssigneeRef,
  userId: string
): boolean {
  const ids = wo.assigneeIds;
  if (ids && ids.length > 0) return ids.includes(userId);
  return wo.assigneeId === userId;
}

/** Same check using assignee user ids loaded from the database. */
export function workOrderAssignedToUserIds(
  assigneeIds: string[],
  legacyAssigneeId: string | null,
  userId: string
): boolean {
  if (assigneeIds.length > 0) return assigneeIds.includes(userId);
  return legacyAssigneeId === userId;
}
