/**
 * Keep in sync with `lib/checklist-item-tree.ts` at repo root.
 * Lives under `mobile/lib` so Metro bundles Android/iOS without resolving outside the Expo app root.
 */
export type ChecklistTreeRow = {
  id: string;
  parentItemId?: string | null;
  sortOrder?: number;
};

export function sortChecklistChildren<T extends ChecklistTreeRow>(
  all: T[],
  parentId: string | null
): T[] {
  return all
    .filter((x) => (x.parentItemId ?? null) === parentId)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

/** Depth-first order: roots by `sortOrder`, then each subtree under its parent (matches template editor order). */
export function flattenChecklistTreeForDisplay<T extends ChecklistTreeRow>(
  all: readonly T[]
): T[] {
  const list = [...all];
  const out: T[] = [];
  function walk(parentId: string | null) {
    for (const row of sortChecklistChildren(list, parentId)) {
      out.push(row);
      walk(row.id);
    }
  }
  walk(null);
  return out;
}

export function checklistItemDepth(
  item: { id: string; parentItemId?: string | null },
  all: { id: string; parentItemId?: string | null }[]
): number {
  let d = 0;
  let p: string | null | undefined = item.parentItemId ?? null;
  while (p) {
    d += 1;
    p = all.find((x) => x.id === p)?.parentItemId ?? null;
  }
  return d;
}
