/** Filter people for assignee typeahead (no DB — safe for Vitest). */

export function normalizeAssigneeSearch(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

export function filterUsersByAssigneeQuery<T extends { id: string; name: string }>(
  users: T[],
  query: string,
  excludeIds: Iterable<string> = [],
  limit = 8
): T[] {
  const needle = normalizeAssigneeSearch(query);
  if (!needle) return [];
  const excluded = new Set(
    Array.from(excludeIds, (id) => String(id).trim()).filter(Boolean)
  );
  const out: T[] = [];
  for (const user of users) {
    if (excluded.has(user.id)) continue;
    if (!normalizeAssigneeSearch(user.name).includes(needle)) continue;
    out.push(user);
    if (out.length >= limit) break;
  }
  return out;
}
