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
  all: readonly { id: string; parentItemId?: string | null }[]
): number {
  let d = 0;
  let p: string | null | undefined = item.parentItemId ?? null;
  while (p) {
    d += 1;
    p = all.find((x) => x.id === p)?.parentItemId ?? null;
  }
  return d;
}

/** True when `item` is nested under `ancestorId` via `parentItemId` links. */
export function isChecklistDescendantOf(
  item: { id: string; parentItemId?: string | null },
  ancestorId: string,
  all: readonly { id: string; parentItemId?: string | null }[]
): boolean {
  let p: string | null | undefined = item.parentItemId ?? null;
  while (p) {
    if (p === ancestorId) return true;
    p = all.find((x) => x.id === p)?.parentItemId ?? null;
  }
  return false;
}

export type ChecklistDisplayGroup<T extends { id: string; type: string }> =
  | { kind: "loose"; items: T[] }
  | { kind: "section"; section: T; items: T[] };

/**
 * Splits a depth-first flat list into one card per `section` row.
 * A section card only includes non-section items whose `parentItemId` chain
 * reaches that section. Root-level fields after the section subtree stay loose.
 * Nested child sections get their own cards (not inside the parent card).
 */
export function groupFlattenedChecklistBySection<
  T extends { id: string; type: string; parentItemId?: string | null },
>(
  flat: readonly T[],
  all: readonly { id: string; parentItemId?: string | null }[]
): ChecklistDisplayGroup<T>[] {
  const groups: ChecklistDisplayGroup<T>[] = [];
  let loose: T[] = [];
  let i = 0;
  while (i < flat.length) {
    const item = flat[i]!;
    if (item.type === "section") {
      if (loose.length > 0) {
        groups.push({ kind: "loose", items: loose });
        loose = [];
      }
      const section = item;
      i += 1;
      const items: T[] = [];
      while (i < flat.length && isChecklistDescendantOf(flat[i]!, section.id, all)) {
        const next = flat[i]!;
        if (next.type === "section") {
          break;
        }
        items.push(next);
        i += 1;
      }
      groups.push({ kind: "section", section, items });
      continue;
    }
    loose.push(item);
    i += 1;
  }
  if (loose.length > 0) {
    groups.push({ kind: "loose", items: loose });
  }
  return groups;
}
