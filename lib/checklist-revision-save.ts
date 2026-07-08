export type RevisionSubmissionAction = "save" | "submit_review";

export type EditableRevisionStatus = "draft" | "proposed";

/** Status to persist when saving a checklist template revision. */
export function resolveRevisionSaveStatus(
  submissionAction: RevisionSubmissionAction,
  existingStatus: EditableRevisionStatus | null
): EditableRevisionStatus {
  if (submissionAction === "submit_review") return "proposed";
  if (existingStatus === "proposed") return "proposed";
  return "draft";
}

/** Whether the author may open the revision editor for this row. */
export function canAuthorEditChecklistRevision(input: {
  status: string;
  proposedByUserId: string | null;
  sessionId: string | null;
}): boolean {
  if (!input.sessionId || input.proposedByUserId !== input.sessionId) return false;
  return input.status === "draft" || input.status === "proposed";
}
