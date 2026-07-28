export type FolderRow = { id: string; parentFolderId: string | null };

/** Descendants of `folderId` (not including `folderId`). */
export function folderDescendantIds(
  folderId: string,
  folders: FolderRow[]
): Set<string> {
  const out = new Set<string>();
  const stack = [folderId];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const f of folders) {
      if (f.parentFolderId === cur && !out.has(f.id)) {
        out.add(f.id);
        stack.push(f.id);
      }
    }
  }
  return out;
}

/** True if setting folder's parent to `newParentId` would create a cycle. */
export function folderMoveCreatesCycle(
  folderId: string,
  newParentId: string | null,
  folders: FolderRow[]
): boolean {
  if (newParentId === null) return false;
  if (newParentId === folderId) return true;
  return folderDescendantIds(folderId, folders).has(newParentId);
}

export type ChecklistSearchFolder = FolderRow & { name: string };
export type ChecklistSearchTemplate = {
  id: string;
  name: string;
  description: string | null;
  folderId: string | null;
};

function matchesQuery(text: string | null | undefined, q: string): boolean {
  if (!text) return false;
  return text.toLowerCase().includes(q);
}

/** Ancestors of `folderId` (not including `folderId`), root-first. */
export function folderAncestorIds(
  folderId: string,
  folders: FolderRow[]
): string[] {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const parts: string[] = [];
  let cur: string | null = byId.get(folderId)?.parentFolderId ?? null;
  const guard = new Set<string>();
  while (cur && !guard.has(cur)) {
    guard.add(cur);
    parts.unshift(cur);
    cur = byId.get(cur)?.parentFolderId ?? null;
  }
  return parts;
}

/**
 * Filter folders/templates by search query.
 * - Empty query → all templates; no forced folder visibility set (caller shows all).
 * - Non-empty → matching templates + folders whose name matches or that sit on the
 *   path to a match (ancestors). `openFolderIds` lists folders to keep expanded.
 */
export function filterChecklistsBySearch<
  F extends ChecklistSearchFolder,
  T extends ChecklistSearchTemplate,
>(
  folders: F[],
  templates: T[],
  query: string
): {
  searching: boolean;
  visibleFolderIds: Set<string> | null;
  templates: T[];
  openFolderIds: Set<string>;
} {
  const q = query.trim().toLowerCase();
  if (!q) {
    return {
      searching: false,
      visibleFolderIds: null,
      templates,
      openFolderIds: new Set(),
    };
  }

  const matchedTemplates = templates.filter(
    (t) => matchesQuery(t.name, q) || matchesQuery(t.description, q)
  );
  const nameMatchedFolderIds = new Set(
    folders.filter((f) => matchesQuery(f.name, q)).map((f) => f.id)
  );

  const visibleFolderIds = new Set<string>();
  Array.from(nameMatchedFolderIds).forEach((id) => {
    visibleFolderIds.add(id);
    for (const a of folderAncestorIds(id, folders)) visibleFolderIds.add(a);
  });
  for (const t of matchedTemplates) {
    if (!t.folderId) continue;
    visibleFolderIds.add(t.folderId);
    for (const a of folderAncestorIds(t.folderId, folders)) {
      visibleFolderIds.add(a);
    }
  }

  const matchedIds = new Set(matchedTemplates.map((t) => t.id));
  const templatesOut = templates.filter((t) => {
    if (matchedIds.has(t.id)) return true;
    // Folder name match → include its direct templates
    return t.folderId != null && nameMatchedFolderIds.has(t.folderId);
  });

  const openFolderIds = new Set(visibleFolderIds);

  return {
    searching: true,
    visibleFolderIds,
    templates: templatesOut,
    openFolderIds,
  };
}
