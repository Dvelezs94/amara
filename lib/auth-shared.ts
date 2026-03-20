/** Tipos y constantes usables en Client Components (sin next/headers). */

export const AVAILABLE_USER_ROLES = [
  "technician",
  "supervisor",
  "admin",
] as const;
export type UserRole = (typeof AVAILABLE_USER_ROLES)[number];

export type SessionUser = {
  id: string;
  username: string;
  email: string | null;
  name: string;
  role: UserRole;
  avatarUrl: string | null;
};
