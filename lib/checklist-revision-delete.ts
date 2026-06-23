import type { UserRole } from "@/lib/auth-shared";

export type RevisionDeleteRow = {
  id: string;
  status: string;
  proposedByUserId: string | null;
};

/** Whether the user may remove a revision from history (not the live template). */
export function canDeleteChecklistRevision(
  role: UserRole,
  sessionId: string | null,
  revision: RevisionDeleteRow
): boolean {
  if (revision.id === "revision-0-virtual") return false;
  if (role === "calidad") return false;
  if (role === "admin") return true;
  if (!sessionId || revision.proposedByUserId !== sessionId) return false;
  return (
    revision.status === "draft" ||
    revision.status === "proposed" ||
    revision.status === "rejected"
  );
}
