/**
 * Keep in sync with `lib/checklist-notification-parse.ts` at repo root.
 * Lives under `mobile/lib` so Metro bundles Android/iOS without resolving outside the Expo app root.
 */
const CHECKLIST_REVISION_PREFIX =
  /^\[checklist:([^\]]+)\](?:\[rev:([^\]]+)\])?\s*/;

/** Notification title for checklist revisions submitted for calidad review. */
export const CHECKLIST_REVISION_REVIEW_TITLE = "Nueva revisión de checklist";

export function buildChecklistRevisionReviewRequestBody(input: {
  templateId: string;
  revisionId: string;
  templateName: string;
  revisionName: string;
  proposedByName: string | null;
}): string {
  const who = input.proposedByName?.trim() ? ` · ${input.proposedByName.trim()}` : "";
  return `[checklist:${input.templateId}][rev:${input.revisionId}] ${input.templateName} · Revisión ${input.revisionName}${who}`;
}

/** Parses bodies produced by {@link buildChecklistRevisionReviewRequestBody} (and legacy `[checklist:id]` only). */
export function parseChecklistRevisionNotificationBody(body: string | null): {
  checklistId: string;
  revisionId: string | null;
  cleanBody: string;
} | null {
  if (!body) return null;
  const match = body.match(CHECKLIST_REVISION_PREFIX);
  if (!match) return null;
  const checklistId = (match[1] ?? "").trim();
  const revisionId = match[2]?.trim() || null;
  if (!checklistId) return null;
  return {
    checklistId,
    revisionId,
    cleanBody: body.replace(CHECKLIST_REVISION_PREFIX, ""),
  };
}

export function checklistRevisionNotificationHref(parsed: {
  checklistId: string;
  revisionId: string | null;
}): string {
  if (parsed.revisionId) {
    return `/checklists/${parsed.checklistId}/revisions/${parsed.revisionId}`;
  }
  return `/checklists/${parsed.checklistId}/revisions`;
}
