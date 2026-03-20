import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  maintenanceSchedules,
  assets,
  checklistTemplates,
  users,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createId } from "@/lib/id";
import { recordAuditLog } from "@/lib/audit";
import {
  buildRecurrenceJson,
  computeFirstOccurrence,
  type MaintenanceFrequency,
  type MaintenanceRecurrenceRule,
} from "@/lib/maintenance-recurrence";

const FREQUENCIES: MaintenanceFrequency[] = [
  "none",
  "daily",
  "weekly",
  "monthly",
  "yearly",
];

function isYmd(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
  }

  const startDate = typeof body.startDate === "string" ? body.startDate.trim() : "";
  if (!isYmd(startDate)) {
    return NextResponse.json(
      { error: "startDate debe ser YYYY-MM-DD" },
      { status: 400 }
    );
  }

  const frequency = body.frequency as MaintenanceFrequency;
  if (!FREQUENCIES.includes(frequency)) {
    return NextResponse.json({ error: "Frecuencia no válida" }, { status: 400 });
  }

  let interval = Number(body.interval);
  if (!Number.isFinite(interval) || interval < 1) interval = 1;
  interval = Math.floor(interval);
  if (interval > 365 && frequency === "daily") {
    return NextResponse.json(
      { error: "Intervalo demasiado grande" },
      { status: 400 }
    );
  }

  let weekdays: number[] | undefined;
  if (
    frequency === "weekly" &&
    body.weekdays !== undefined &&
    body.weekdays !== null
  ) {
    const raw = Array.isArray(body.weekdays) ? body.weekdays : [];
    const parsed = raw
      .map((n: unknown) => Number(n))
      .filter(
        (n: number): n is number => Number.isInteger(n) && n >= 0 && n <= 6
      );
    weekdays = parsed.length > 0 ? parsed : undefined;
  }

  let until: string | null = null;
  if (body.until != null && body.until !== "") {
    const u = String(body.until).trim();
    if (!isYmd(u)) {
      return NextResponse.json(
        { error: "until debe ser YYYY-MM-DD" },
        { status: 400 }
      );
    }
    if (u < startDate) {
      return NextResponse.json(
        { error: "La fecha final debe ser posterior al inicio" },
        { status: 400 }
      );
    }
    until = u;
  }

  const assetId =
    body.assetId != null && body.assetId !== ""
      ? String(body.assetId)
      : null;
  if (assetId) {
    const a = await db.query.assets.findFirst({
      where: eq(assets.id, assetId),
    });
    if (!a) {
      return NextResponse.json({ error: "Activo no encontrado" }, { status: 400 });
    }
  }

  const assigneeId =
    body.assigneeId != null && body.assigneeId !== ""
      ? String(body.assigneeId)
      : null;
  if (assigneeId) {
    const u = await db.query.users.findFirst({
      where: eq(users.id, assigneeId),
    });
    if (!u) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 400 }
      );
    }
  }

  let checklistTemplateId: string | null =
    body.checklistTemplateId != null && body.checklistTemplateId !== ""
      ? String(body.checklistTemplateId)
      : null;
  if (checklistTemplateId) {
    const t = await db.query.checklistTemplates.findFirst({
      where: eq(checklistTemplates.id, checklistTemplateId),
    });
    if (!t) {
      return NextResponse.json(
        { error: "Plantilla de checklist no encontrada" },
        { status: 400 }
      );
    }
  }

  const rule: MaintenanceRecurrenceRule = {
    frequency,
    interval,
    anchorDate: startDate,
    until,
    ...(weekdays && weekdays.length > 0 ? { weekdays } : {}),
  };

  if (
    frequency === "weekly" &&
    interval > 1 &&
    rule.weekdays &&
    rule.weekdays.length > 1
  ) {
    rule.weekdays = [rule.weekdays[0]!];
  }

  const recurrence = buildRecurrenceJson(rule);
  const nextRunAt = computeFirstOccurrence(rule);

  const id = createId();
  await db.insert(maintenanceSchedules).values({
    id,
    name,
    assetId,
    assigneeId,
    checklistTemplateId,
    recurrence,
    nextRunAt,
  });

  await recordAuditLog({
    entityType: "maintenance_schedule",
    entityId: id,
    action: "created",
    userId: session.id,
    metadata: {
      name,
      recurrence: rule,
      nextRunAt: nextRunAt.toISOString(),
    },
  });

  return NextResponse.json({
    id,
    nextRunAt: nextRunAt.toISOString(),
  });
}
