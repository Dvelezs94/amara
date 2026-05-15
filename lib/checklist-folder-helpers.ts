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
