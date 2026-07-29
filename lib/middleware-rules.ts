/**
 * Session cookie decoding and técnico path allowlists for `middleware.ts`.
 * Kept in `lib/` so Vitest can cover rules without importing Next middleware.
 */

export const API_AUTH_PUBLIC_PREFIX = "/api/auth/";

export const TECNICO_ALLOWED_APP_PREFIXES = [
  "/tareas",
  "/knowledge-base",
  "/profile",
  "/equipo",
] as const;

export const CALIDAD_ALLOWED_APP_PREFIXES = [
  "/checklists",
  "/tareas",
  "/equipo",
] as const;

export const TECNICO_ALLOWED_API_PREFIXES = [
  "/api/work-orders",
  "/api/knowledge-base",
  "/api/asset-files",
  "/api/users/me/avatar",
  "/api/users",
  "/api/assets",
  "/api/asset-groups",
  "/api/checklist-templates",
  "/api/checklist-folders",
  "/api/notifications",
  "/api/app-settings/work-order-status-colors",
] as const;

export const CALIDAD_ALLOWED_API_PREFIXES = [
  "/api/checklist-templates",
  "/api/checklist-folders",
  "/api/work-orders",
  "/api/assets",
  "/api/asset-groups",
  "/api/users",
  "/api/notifications",
  "/api/users/me/avatar",
  "/api/app-settings/work-order-status-colors",
] as const;

/** Decode `role` from the JWT-style session cookie payload (middle segment). */
export function decodeSessionRoleFromCookie(token: string): string | null {
  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return null;
    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "="
    );
    const payload = JSON.parse(atob(padded)) as { role?: unknown };
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

export function isPathUnderAnyPrefix(
  path: string,
  prefixes: readonly string[]
): boolean {
  return prefixes.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );
}

export function isTecnicoApiPathAllowed(path: string): boolean {
  if (path.startsWith(API_AUTH_PUBLIC_PREFIX)) return true;
  return isPathUnderAnyPrefix(path, TECNICO_ALLOWED_API_PREFIXES);
}

export function isTecnicoAppPathAllowed(path: string): boolean {
  return isPathUnderAnyPrefix(path, TECNICO_ALLOWED_APP_PREFIXES);
}

export function isCalidadApiPathAllowed(path: string): boolean {
  if (path.startsWith(API_AUTH_PUBLIC_PREFIX)) return true;
  return isPathUnderAnyPrefix(path, CALIDAD_ALLOWED_API_PREFIXES);
}

export function isCalidadAppPathAllowed(path: string): boolean {
  return isPathUnderAnyPrefix(path, CALIDAD_ALLOWED_APP_PREFIXES);
}
