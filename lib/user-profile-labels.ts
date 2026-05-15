/** Spanish labels for profile UI (no DB import — safe for Vitest). */
export function formatRoleLabel(role: string): string {
  const map: Record<string, string> = {
    admin: "Administrador",
    tecnico: "Técnico",
    operator: "Operador",
    calidad: "Calidad",
    supervisor: "Supervisor",
  };
  return map[role] ?? role;
}
