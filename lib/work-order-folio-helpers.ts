export const INITIAL_WORK_ORDER_FOLIO = 2000;

/** Pure: next folio given current max (or null/undefined). */
export function computeNextWorkOrderFolio(maxFolio: number | null | undefined): number {
  const max = Number(maxFolio ?? 0);
  const safe = Number.isFinite(max) ? max : 0;
  return Math.max(INITIAL_WORK_ORDER_FOLIO, safe + 1);
}
