/** Colores legibles con texto blanco (uso en iniciales de avatar). */
const AVATAR_PALETTE = [
  "#2563eb",
  "#7c3aed",
  "#c026d3",
  "#db2777",
  "#dc2626",
  "#ea580c",
  "#ca8a04",
  "#16a34a",
  "#0d9488",
  "#0891b2",
] as const;

export function userInitials(name: string): string {
  const t = name.trim();
  if (!t) return "?";
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0][0] ?? "";
    const b = parts[1][0] ?? "";
    return (a + b).toUpperCase().slice(0, 2);
  }
  return t[0]!.toUpperCase();
}

/** Color estable por id de usuario (misma persona, mismo color). */
export function avatarBackgroundForUserId(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[idx]!;
}
