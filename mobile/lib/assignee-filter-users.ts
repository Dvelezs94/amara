/** Order people chips on the mobile tareas filter: current user first, then A–Z. */

export function sortAssigneeFilterUsers<T extends { id: string; name: string }>(
  users: T[],
  currentUserId: string | null | undefined,
  locale = "es"
): T[] {
  const meId = currentUserId?.trim() || null;
  const me: T[] = [];
  const others: T[] = [];
  for (const user of users) {
    if (meId && user.id === meId) me.push(user);
    else others.push(user);
  }
  others.sort((a, b) => a.name.localeCompare(b.name, locale, { sensitivity: "base" }));
  return [...me, ...others];
}
