/** Colores legibles con texto blanco (uso en iniciales de avatar). */
const AVATAR_PALETTE = [
  "#1F3C88",
  "#2A4C9B",
  "#3A5BB0",
  "#1A3272",
  "#F36C21",
  "#D95A16",
  "#6FAF6F",
  "#4A4A4A",
  "#222222",
  "#557DDA",
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
