/** Work orders that count toward checklist analytics (completed with a completion timestamp). */
export function workOrderCountsForChecklistAnalytics(
  status: string | null | undefined,
  completedAt: string | Date | null | undefined
): boolean {
  if (status !== "completed") return false;
  if (completedAt == null) return false;
  const t = new Date(completedAt).getTime();
  return Number.isFinite(t);
}
