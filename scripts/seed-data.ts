import {
  DEFAULT_CALENDAR_ID,
  DEFAULT_CALENDAR_NAME,
} from "../lib/calendar-helpers";
import type { SeedChecklistItemDef } from "../lib/seed-helpers";

export const SEED_PASSWORDS = {
  admin: "1234aA",
  tecnico: "operador1234",
  calidad: "calidad1234",
} as const;

export const userSeed = [
  {
    username: "admin",
    email: "admin@admin.com",
    name: "Administrador Planta",
    role: "admin" as const,
    password: SEED_PASSWORDS.admin,
    avatarBackgroundColor: "#02257D",
  },
  {
    username: "operador",
    email: "operador@metalnova.local",
    name: "Técnico Turno A",
    role: "tecnico" as const,
    password: SEED_PASSWORDS.tecnico,
    avatarBackgroundColor: "#F14C03",
  },
  {
    username: "operador.b",
    email: "operador.b@metalnova.local",
    name: "Técnico Turno B",
    role: "tecnico" as const,
    password: SEED_PASSWORDS.tecnico,
    avatarBackgroundColor: "#0D9488",
  },
  {
    username: "calidad",
    email: "calidad@metalnova.local",
    name: "Inspector de Calidad",
    role: "calidad" as const,
    password: SEED_PASSWORDS.calidad,
    avatarBackgroundColor: "#7C3AED",
  },
];

export const assetGroupSeed = [
  { name: "Tratamiento térmico", sortOrder: 0 },
  { name: "Soldadura", sortOrder: 1 },
  { name: "Conformado", sortOrder: 2 },
  { name: "Servicios", sortOrder: 3 },
  { name: "Corte", sortOrder: 4 },
  { name: "Logística interna", sortOrder: 5 },
];

export const assetSeed = [
  {
    name: "Horno de tratamiento termico HT-01",
    assetId: "HORNO-HT-01",
    groupName: "Tratamiento térmico",
    metadata: { area: "Tratamiento termico", fabricante: "Nabertherm", criticidad: "alta" },
  },
  {
    name: "Horno de recocido HT-02",
    assetId: "HORNO-HT-02",
    groupName: "Tratamiento térmico",
    metadata: { area: "Tratamiento termico", fabricante: "Nabertherm", criticidad: "media" },
  },
  {
    name: "Extractor de humos EX-03",
    assetId: "EXTR-03",
    groupName: "Soldadura",
    metadata: { area: "Soldadura", fabricante: "Soler", criticidad: "alta" },
  },
  {
    name: "Soldadora MIG SW-01",
    assetId: "SOLD-MIG-01",
    groupName: "Soldadura",
    metadata: { area: "Soldadura", fabricante: "Lincoln", criticidad: "media" },
  },
  {
    name: "Prensa hidraulica 200T PH-02",
    assetId: "PRENSA-200T-02",
    groupName: "Conformado",
    metadata: { area: "Conformado", fabricante: "Hidromec", criticidad: "media" },
  },
  {
    name: "Dobladora de lamina DB-01",
    assetId: "DOBLA-DB-01",
    groupName: "Conformado",
    metadata: { area: "Conformado", fabricante: "Amada", criticidad: "media" },
  },
  {
    name: "Compresor de aire CA-01",
    assetId: "COMP-CA-01",
    groupName: "Servicios",
    metadata: { area: "Servicios", fabricante: "Atlas Copco", criticidad: "alta" },
  },
  {
    name: "Compresor auxiliar CA-02",
    assetId: "COMP-CA-02",
    groupName: "Servicios",
    metadata: { area: "Servicios", fabricante: "Ingersoll Rand", criticidad: "baja" },
  },
  {
    name: "Cortadora laser CL-05",
    assetId: "LASER-CL-05",
    groupName: "Corte",
    metadata: { area: "Corte", fabricante: "Bystronic", criticidad: "alta" },
  },
  {
    name: "Cortadora plasma CP-01",
    assetId: "PLASMA-CP-01",
    groupName: "Corte",
    metadata: { area: "Corte", fabricante: "Hypertherm", criticidad: "media" },
  },
  {
    name: "Puente grua PG-02",
    assetId: "GRUA-PG-02",
    groupName: "Logística interna",
    metadata: { area: "Logistica interna", fabricante: "Demag", criticidad: "media" },
  },
  {
    name: "Montacargas MC-03",
    assetId: "MONTA-MC-03",
    groupName: "Logística interna",
    tracksMachineDowntime: false,
    metadata: { area: "Logistica interna", fabricante: "Toyota", criticidad: "baja" },
  },
];

export const checklistFolderSeed = [
  { name: "Preventivo", sortOrder: 0 },
  { name: "Inspección diaria", sortOrder: 1 },
  { name: "Correctivo", sortOrder: 2 },
];

const step = (label: string, extra?: Partial<SeedChecklistItemDef>): SeedChecklistItemDef => ({
  type: "step",
  label,
  ...extra,
});

const field = (
  label: string,
  fieldType: SeedChecklistItemDef["fieldType"],
  extra?: Partial<SeedChecklistItemDef>
): SeedChecklistItemDef => ({
  type: "custom_field",
  label,
  fieldType,
  ...extra,
});

export const checklistSeed: Array<{
  name: string;
  description: string;
  folderName: string;
  items: SeedChecklistItemDef[];
}> = [
  {
    name: "Checklist semanal de horno industrial",
    description: "Revisión preventiva de seguridad, combustión y limpieza del horno.",
    folderName: "Preventivo",
    items: [
      { type: "section", label: "Seguridad", key: "seg" },
      step("Verificar estado general de aislamiento térmico", { parentKey: "seg" }),
      step("Comprobar funcionamiento de válvulas y línea de gas", { parentKey: "seg" }),
      { type: "section", label: "Proceso", key: "pro" },
      step("Revisar sensores de temperatura y termocuplas", { parentKey: "pro" }),
      field("Temperatura máxima registrada (C)", "number", { parentKey: "pro" }),
      field("Estado del quemador", "dropdown", {
        parentKey: "pro",
        options: ["Operativo", "Con ajuste", "Fuera de servicio"],
      }),
      field("Observaciones del técnico", "text", { parentKey: "pro", isOptional: true }),
    ],
  },
  {
    name: "Checklist diario de extractor de humos",
    description: "Control diario de flujo, filtros y seguridad del extractor.",
    folderName: "Inspección diaria",
    items: [
      step("Verificar arranque y vibraciones del motor"),
      step("Inspección visual de filtros y sellos"),
      step("Comprobar alarmas y presostatos"),
      field("Caudal medido (m3/h)", "number"),
      field("Evidencia fotográfica", "photo", { isOptional: true }),
    ],
  },
  {
    name: "Checklist mensual de compresor",
    description: "Mantenimiento mensual de compresor en planta metalmecánica.",
    folderName: "Preventivo",
    items: [
      { type: "section", label: "Mecánico", key: "mec" },
      step("Revisar fugas en líneas y conexiones", { parentKey: "mec" }),
      step("Comprobar nivel y estado de aceite", { parentKey: "mec" }),
      step("Limpiar o reemplazar filtro de admisión", { parentKey: "mec" }),
      field("Presión de trabajo (bar)", "number", { parentKey: "mec" }),
      field("Horas acumuladas de operación", "number", { parentKey: "mec" }),
      field("Evidencia fotográfica", "photo", { parentKey: "mec", isOptional: true }),
    ],
  },
  {
    name: "Checklist semanal de prensa hidráulica",
    description: "Inspección de seguridad, fugas y ciclo de la prensa.",
    folderName: "Preventivo",
    items: [
      { type: "section", label: "Seguridad", key: "seg" },
      step("Probar cortinas y paros de emergencia", { parentKey: "seg" }),
      step("Verificar protecciones fijas y señalética", { parentKey: "seg" }),
      { type: "section", label: "Hidráulico", key: "hid" },
      step("Inspeccionar mangueras, sellos y nivel de aceite", { parentKey: "hid" }),
      field("Presión máxima del ciclo (bar)", "number", { parentKey: "hid" }),
      field("Resultado", "dropdown", {
        parentKey: "hid",
        options: ["OK", "Ajuste", "Requiere paro"],
      }),
    ],
  },
  {
    name: "Checklist diario de cortadora láser",
    description: "Arranque de turno: óptica, gases y mesa de corte.",
    folderName: "Inspección diaria",
    items: [
      step("Limpieza de lentes y tobera"),
      step("Verificar presiones de N2/O2"),
      step("Homologar origen y revisar mesa de listones"),
      field("Horas de láser", "number"),
      field("Calidad de corte", "dropdown", {
        options: ["Excelente", "Aceptable", "Retrabajo"],
      }),
    ],
  },
  {
    name: "Inspección de puente grúa",
    description: "Revisión de cables, ganchos, frenos y mandos.",
    folderName: "Preventivo",
    items: [
      step("Inspeccionar cable y gancho de carga"),
      step("Probar frenos y fin de carrera"),
      step("Verificar mandos y alarma sonora"),
      field("Carga de prueba (kg)", "number", { isOptional: true }),
      field("Dictamen", "dropdown", { options: ["Apto", "Observaciones", "Fuera de servicio"] }),
    ],
  },
  {
    name: "Lubricación general de planta",
    description: "Ronda de lubricación en puntos críticos.",
    folderName: "Preventivo",
    items: [
      step("Lubricar cojinetes y guías programados"),
      step("Registrar consumo de grasa"),
      field("Puntos lubricados", "number"),
      field("Comentarios", "text", { isOptional: true }),
    ],
  },
  {
    name: "Arranque de turno",
    description: "Checklist genérico de arranque para cualquier área.",
    folderName: "Inspección diaria",
    items: [
      {
        type: "text_block",
        label: "Completar al inicio de cada turno antes de producir.",
        fieldType: "paragraph",
      },
      step("Revisar orden y limpieza del área"),
      step("Confirmar EPP del personal"),
      field("Turno", "dropdown", { options: ["A", "B", "C"] }),
      field("Incidencias", "text", { isOptional: true }),
    ],
  },
];

export const calendarSeed = [
  {
    id: DEFAULT_CALENDAR_ID,
    name: DEFAULT_CALENDAR_NAME,
    color: "#02257D",
    sortOrder: 0,
  },
  {
    id: "cal_soldadura",
    name: "Soldadura",
    color: "#F14C03",
    sortOrder: 1,
  },
  {
    id: "cal_tratamiento",
    name: "Tratamiento térmico",
    color: "#7C3AED",
    sortOrder: 2,
  },
  {
    id: "cal_servicios",
    name: "Servicios",
    color: "#0D9488",
    sortOrder: 3,
  },
  {
    id: "cal_corte",
    name: "Corte",
    color: "#CA8A04",
    sortOrder: 4,
  },
];

export type SeedScheduleDef = {
  name: string;
  assetCode: string;
  calendarId: string;
  templateName: string;
  assigneeUsernames: string[];
  color: string;
  frequency: "daily" | "weekly" | "monthly";
  interval: number;
  weekdays?: number[];
  /** Days before today for the recurrence anchor. */
  anchorOffsetDays: number;
};

export const scheduleSeed: SeedScheduleDef[] = [
  {
    name: "Lubricación diaria extractor EX-03",
    assetCode: "EXTR-03",
    calendarId: "cal_soldadura",
    templateName: "Checklist diario de extractor de humos",
    assigneeUsernames: ["operador"],
    color: "#F14C03",
    frequency: "daily",
    interval: 1,
    anchorOffsetDays: -14,
  },
  {
    name: "Preventivo semanal horno HT-01",
    assetCode: "HORNO-HT-01",
    calendarId: "cal_tratamiento",
    templateName: "Checklist semanal de horno industrial",
    assigneeUsernames: ["operador", "operador.b"],
    color: "#7C3AED",
    frequency: "weekly",
    interval: 1,
    weekdays: [1],
    anchorOffsetDays: -28,
  },
  {
    name: "Compresor CA-01 mensual",
    assetCode: "COMP-CA-01",
    calendarId: "cal_servicios",
    templateName: "Checklist mensual de compresor",
    assigneeUsernames: ["operador.b"],
    color: "#0D9488",
    frequency: "monthly",
    interval: 1,
    anchorOffsetDays: -60,
  },
  {
    name: "Inspección semanal puente grúa PG-02",
    assetCode: "GRUA-PG-02",
    calendarId: DEFAULT_CALENDAR_ID,
    templateName: "Inspección de puente grúa",
    assigneeUsernames: ["operador"],
    color: "#02257D",
    frequency: "weekly",
    interval: 1,
    weekdays: [3],
    anchorOffsetDays: -21,
  },
  {
    name: "Cortadora láser trimestral CL-05",
    assetCode: "LASER-CL-05",
    calendarId: "cal_corte",
    templateName: "Checklist diario de cortadora láser",
    assigneeUsernames: ["operador.b"],
    color: "#CA8A04",
    frequency: "monthly",
    interval: 3,
    anchorOffsetDays: -90,
  },
  {
    name: "Prensa PH-02 semanal",
    assetCode: "PRENSA-200T-02",
    calendarId: DEFAULT_CALENDAR_ID,
    templateName: "Checklist semanal de prensa hidráulica",
    assigneeUsernames: ["operador"],
    color: "#02257D",
    frequency: "weekly",
    interval: 1,
    weekdays: [2],
    anchorOffsetDays: -21,
  },
  {
    name: "Arranque diario láser CL-05",
    assetCode: "LASER-CL-05",
    calendarId: "cal_corte",
    templateName: "Checklist diario de cortadora láser",
    assigneeUsernames: ["operador", "operador.b"],
    color: "#CA8A04",
    frequency: "weekly",
    interval: 1,
    weekdays: [1, 2, 3, 4, 5],
    anchorOffsetDays: -10,
  },
  {
    name: "Horno HT-02 mensual",
    assetCode: "HORNO-HT-02",
    calendarId: "cal_tratamiento",
    templateName: "Checklist semanal de horno industrial",
    assigneeUsernames: ["operador.b"],
    color: "#7C3AED",
    frequency: "monthly",
    interval: 1,
    anchorOffsetDays: -40,
  },
];

export type SeedWorkOrderDef = {
  title: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  priority: "low" | "medium" | "high" | "urgent";
  kind: "routine" | "on_demand";
  assetCode: string | null;
  templateName: string | null;
  assigneeUsernames: string[];
  requesterUsername: string;
  startOffsetDays: number | null;
  dueOffsetDays: number | null;
  countsMachineDowntime?: boolean;
  manualDowntimeMinutes?: number;
  fieldValues?: Record<string, unknown>;
  /** If set, description is replaced with the calendar-generated marker for that schedule. */
  scheduleName?: string;
  notes?: string[];
};

const compressorHistory: SeedWorkOrderDef[] = [28, 21, 14, 7].map((daysAgo, i) => ({
  title: `Rutina compresor CA-01 — hace ${daysAgo} días`,
  description: "Ejecución de rutina mensual para validar presión, aceite y fugas de línea.",
  status: "completed" as const,
  priority: "medium" as const,
  kind: "routine" as const,
  assetCode: "COMP-CA-01",
  templateName: "Checklist mensual de compresor",
  assigneeUsernames: ["operador.b"],
  requesterUsername: "admin",
  startOffsetDays: -daysAgo,
  dueOffsetDays: -daysAgo,
  countsMachineDowntime: i === 0,
  fieldValues: {
    "Presión de trabajo (bar)": 6.8 + i * 0.15,
    "Horas acumuladas de operación": 1600 + i * 85,
  },
  scheduleName: "Compresor CA-01 mensual",
}));

const hornoHistory: SeedWorkOrderDef[] = [20, 13, 6].map((daysAgo, i) => ({
  title: `Preventivo horno HT-01 — hace ${daysAgo} días`,
  description: "Revisión preventiva semanal de combustión y termocuplas.",
  status: "completed" as const,
  priority: "high" as const,
  kind: "routine" as const,
  assetCode: "HORNO-HT-01",
  templateName: "Checklist semanal de horno industrial",
  assigneeUsernames: ["operador"],
  requesterUsername: "admin",
  startOffsetDays: -daysAgo,
  dueOffsetDays: -daysAgo,
  fieldValues: {
    "Temperatura máxima registrada (C)": 780 + i * 12,
    "Estado del quemador": i === 2 ? "Con ajuste" : "Operativo",
    "Observaciones del técnico": i === 2 ? "Ajuste menor en llama piloto." : "Sin novedad.",
  },
  scheduleName: "Preventivo semanal horno HT-01",
}));

export const workOrderSeed: SeedWorkOrderDef[] = [
  {
    title: "Falla de calentamiento en horno HT-01",
    description:
      "El horno no supera los 600C durante el turno nocturno. Revisar quemador y termocupla.",
    status: "pending",
    priority: "urgent",
    kind: "on_demand",
    assetCode: "HORNO-HT-01",
    templateName: "Checklist semanal de horno industrial",
    assigneeUsernames: ["operador"],
    requesterUsername: "admin",
    startOffsetDays: 0,
    dueOffsetDays: 1,
  },
  {
    title: "Mantenimiento preventivo extractor EX-03",
    description:
      "Inspección programada de flujo y estado de filtros en cabina de soldadura.",
    status: "in_progress",
    priority: "high",
    kind: "routine",
    assetCode: "EXTR-03",
    templateName: "Checklist diario de extractor de humos",
    assigneeUsernames: ["operador"],
    requesterUsername: "admin",
    startOffsetDays: 0,
    dueOffsetDays: 0,
    scheduleName: "Lubricación diaria extractor EX-03",
    notes: ["Filtro saturado al 70%. Pedir refacción al almacén."],
  },
  {
    title: "Revision mensual compresor CA-01",
    description:
      "Ejecucion de rutina mensual para validar presion, aceite y fugas de linea.",
    status: "completed",
    priority: "medium",
    kind: "routine",
    assetCode: "COMP-CA-01",
    templateName: "Checklist mensual de compresor",
    assigneeUsernames: ["operador"],
    requesterUsername: "admin",
    startOffsetDays: -3,
    dueOffsetDays: -3,
    fieldValues: {
      "Presión de trabajo (bar)": 7.1,
      "Horas acumuladas de operación": 1980,
    },
  },
  ...compressorHistory,
  ...hornoHistory,
  {
    title: "Inspección puente grúa PG-02 (hoy)",
    description: "Ronda semanal de cables, ganchos y frenos.",
    status: "pending",
    priority: "high",
    kind: "routine",
    assetCode: "GRUA-PG-02",
    templateName: "Inspección de puente grúa",
    assigneeUsernames: ["operador.b"],
    requesterUsername: "admin",
    startOffsetDays: 0,
    dueOffsetDays: 0,
    scheduleName: "Inspección semanal puente grúa PG-02",
  },
  {
    title: "Arranque de turno láser CL-05",
    description: "Limpieza de óptica y verificación de gases al inicio de turno.",
    status: "in_progress",
    priority: "medium",
    kind: "routine",
    assetCode: "LASER-CL-05",
    templateName: "Checklist diario de cortadora láser",
    assigneeUsernames: ["operador", "operador.b"],
    requesterUsername: "admin",
    startOffsetDays: 0,
    dueOffsetDays: 0,
    scheduleName: "Arranque diario láser CL-05",
    fieldValues: { "Horas de láser": 4210 },
  },
  {
    title: "Ruido en prensa PH-02 durante cierre",
    description: "Golpeteo metálico al final del ciclo. Revisar holguras y lubricación.",
    status: "pending",
    priority: "high",
    kind: "on_demand",
    assetCode: "PRENSA-200T-02",
    templateName: "Checklist semanal de prensa hidráulica",
    assigneeUsernames: ["operador"],
    requesterUsername: "admin",
    startOffsetDays: 0,
    dueOffsetDays: 2,
    notes: ["Reportado por producción en el turno A."],
  },
  {
    title: "Cambio de filtros extractor EX-03",
    description: "Correctivo: filtros colapsados, sustituir juego completo.",
    status: "in_progress",
    priority: "urgent",
    kind: "on_demand",
    assetCode: "EXTR-03",
    templateName: "Checklist diario de extractor de humos",
    assigneeUsernames: ["operador.b"],
    requesterUsername: "admin",
    startOffsetDays: -1,
    dueOffsetDays: 0,
    countsMachineDowntime: true,
  },
  {
    title: "Ajuste de tobera cortadora plasma CP-01",
    description: "Corte irregular en 10 mm. Revisar altura y desgaste de tobera.",
    status: "pending",
    priority: "medium",
    kind: "on_demand",
    assetCode: "PLASMA-CP-01",
    templateName: "Arranque de turno",
    assigneeUsernames: ["operador"],
    requesterUsername: "admin",
    startOffsetDays: 2,
    dueOffsetDays: 3,
  },
  {
    title: "Lubricación ronda planta (programada)",
    description: "Ronda de lubricación de guías y cojinetes.",
    status: "pending",
    priority: "low",
    kind: "routine",
    assetCode: null,
    templateName: "Lubricación general de planta",
    assigneeUsernames: ["operador.b"],
    requesterUsername: "admin",
    startOffsetDays: 5,
    dueOffsetDays: 5,
  },
  {
    title: "Fuga de aceite dobladora DB-01",
    description: "Charco bajo el cilindro izquierdo. Contener y sellar.",
    status: "completed",
    priority: "urgent",
    kind: "on_demand",
    assetCode: "DOBLA-DB-01",
    templateName: "Checklist semanal de prensa hidráulica",
    assigneeUsernames: ["operador"],
    requesterUsername: "admin",
    startOffsetDays: -2,
    dueOffsetDays: -1,
    countsMachineDowntime: true,
    manualDowntimeMinutes: 45,
    fieldValues: {
      "Presión máxima del ciclo (bar)": 180,
      Resultado: "OK",
    },
    notes: ["Sello reemplazado. Prueba de 20 ciclos sin fuga."],
  },
  {
    title: "Revisión montacargas MC-03 (cancelada)",
    description: "Inspección cancelada: equipo en taller externo.",
    status: "cancelled",
    priority: "low",
    kind: "on_demand",
    assetCode: "MONTA-MC-03",
    templateName: null,
    assigneeUsernames: ["operador.b"],
    requesterUsername: "admin",
    startOffsetDays: -4,
    dueOffsetDays: -4,
  },
  {
    title: "Calibración termocuplas horno HT-02",
    description: "Desviación de +15 C vs patrón. Recalibrar canal 2 y 3.",
    status: "pending",
    priority: "medium",
    kind: "on_demand",
    assetCode: "HORNO-HT-02",
    templateName: "Checklist semanal de horno industrial",
    assigneeUsernames: ["operador", "operador.b"],
    requesterUsername: "admin",
    startOffsetDays: 1,
    dueOffsetDays: 4,
  },
];

export const requestSeed = [
  {
    description: "Ruido anormal en prensa PH-02 durante el ciclo de cierre.",
    priority: "high" as const,
    assetCode: "PRENSA-200T-02",
    requesterUsername: "admin",
    status: "pending" as const,
    convertedWorkOrderTitle: null,
  },
  {
    description: "Solicitud de limpieza profunda en cabina de soldadura.",
    priority: "medium" as const,
    assetCode: "EXTR-03",
    requesterUsername: "admin",
    status: "pending" as const,
    convertedWorkOrderTitle: null,
  },
  {
    description: "Fuga de aceite en dobladora DB-01 reportada por producción.",
    priority: "urgent" as const,
    assetCode: "DOBLA-DB-01",
    requesterUsername: "admin",
    status: "converted" as const,
    convertedWorkOrderTitle: "Fuga de aceite dobladora DB-01",
  },
];

export const proposedRevisionSeed = {
  templateName: "Checklist semanal de horno industrial",
  revisionName: "Agregar medición de presión de gas",
  extraAfterItem: step("Registrar presión de gas en manifold"),
};

export const dashboardWidgetSeed = [
  {
    username: "admin",
    templateName: "Checklist mensual de compresor",
    fieldLabel: "Presión de trabajo (bar)",
    chartTitle: "Presión de trabajo — compresor",
    chartType: "line" as const,
  },
  {
    username: "admin",
    templateName: "Checklist semanal de horno industrial",
    fieldLabel: "Temperatura máxima registrada (C)",
    chartTitle: "Temperatura máxima — horno HT-01",
    chartType: "line" as const,
  },
];
