export type DashboardKpiTone = "primary" | "accent" | "zinc";

export type DashboardKpiId =
  | "mttr"
  | "inactividad"
  | "paro"
  | "planificado"
  | "oee";

export type DashboardKpiCardMeta = {
  id: DashboardKpiId;
  title: string;
  hint: string;
  tone: DashboardKpiTone;
  icon: "timer" | "cycle" | "factory" | "split" | "gauge";
};

export const DASHBOARD_KPI_CARDS: readonly DashboardKpiCardMeta[] = [
  {
    id: "mttr",
    title: "MTTR",
    hint: "Tiempo medio de reparación: promedio de horas desde creación hasta finalización de órdenes completadas.",
    tone: "zinc",
    icon: "timer",
  },
  {
    id: "inactividad",
    title: "Inactividad",
    hint: "Suma de horas (creación → cierre) de órdenes completadas en la ventana; no es el paro de máquina medido en tareas.",
    tone: "zinc",
    icon: "cycle",
  },
  {
    id: "paro",
    title: "Paro de máquina",
    hint: "Suma del tiempo en curso hasta terminada más paro manual, solo en tareas marcadas con paro y en máquinas con seguimiento activado.",
    tone: "accent",
    icon: "factory",
  },
  {
    id: "planificado",
    title: "Planificado vs no planificado",
    hint: "Planificado = tareas rutinarias (calendario). No planificado = órdenes bajo demanda. Sobre tareas creadas en la ventana.",
    tone: "primary",
    icon: "split",
  },
  {
    id: "oee",
    title: "OEE",
    hint: "Eficiencia global del equipo estimada con base en disponibilidad (1 - inactividad / horas disponibles).",
    tone: "primary",
    icon: "gauge",
  },
];

export type DashboardEmptySection = "tareas" | "eventos" | "checklists";

export type DashboardEmptyCopy = {
  message: string;
  href: string;
  cta: string;
};

export const dashboardEmptyCopy: Record<DashboardEmptySection, DashboardEmptyCopy> =
  {
    tareas: {
      message: "No hay tareas pendientes ni en progreso.",
      href: "/tareas",
      cta: "Ir a tareas",
    },
    eventos: {
      message: "No hay eventos próximos en el calendario.",
      href: "/calendario",
      cta: "Ir al calendario",
    },
    checklists: {
      message: "No hay checklists con actividad en este día.",
      href: "/checklists",
      cta: "Ver plantillas",
    },
  };

export function formatDashboardContextBanner(opts: {
  from: string;
  to: string;
  windowDays: number;
}): string {
  const days = Number.isFinite(opts.windowDays)
    ? Math.max(1, Math.floor(opts.windowDays))
    : 1;
  const dayWord = days === 1 ? "día" : "días";
  if (opts.from === opts.to) {
    return `Ventana de ${days} ${dayWord} (${opts.from})`;
  }
  return `Ventana de ${days} ${dayWord} (${opts.from} – ${opts.to})`;
}

export const DEFAULT_DASHBOARD_BLOCK_ORDER = [
  "kpis",
  "lists",
  "checklists",
  "charts",
] as const;

export type DashboardBlockId = (typeof DEFAULT_DASHBOARD_BLOCK_ORDER)[number];

export function isDashboardBlockId(value: unknown): value is DashboardBlockId {
  return (
    value === "kpis" ||
    value === "lists" ||
    value === "checklists" ||
    value === "charts"
  );
}

/** Merge a saved order with the default catalog (unknown ids dropped, missing ids appended). */
export function parseDashboardBlockOrder(raw: unknown): DashboardBlockId[] {
  const seen = new Set<DashboardBlockId>();
  const next: DashboardBlockId[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (isDashboardBlockId(item) && !seen.has(item)) {
        seen.add(item);
        next.push(item);
      }
    }
  }
  for (const id of DEFAULT_DASHBOARD_BLOCK_ORDER) {
    if (!seen.has(id)) next.push(id);
  }
  return next;
}

export function moveDashboardBlock(
  order: readonly DashboardBlockId[],
  fromIndex: number,
  toIndex: number
): DashboardBlockId[] {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= order.length ||
    toIndex >= order.length
  ) {
    return [...order];
  }
  const next = [...order];
  const [removed] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, removed);
  return next;
}
