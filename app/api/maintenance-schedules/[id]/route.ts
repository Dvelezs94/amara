import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { setMaintenanceScheduleAssigneeIds } from "@/lib/assignees";
import { db } from "@/lib/db";
import {
  assets,
  checklistTemplates,
  maintenanceSchedules,
  users,
} from "@/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { recordAuditLog } from "@/lib/audit";
import { parseRecurrencePayloadFromMaintenanceBody } from "@/lib/maintenance-schedule-recurrence-from-request";
import {
  buildRecurrenceJson,
  expandOccurrencesInRange,
  lastOccurrenceStrictlyBefore,
  nextScheduledOccurrenceOnOrAfter,
  parseRecurrence,
  parseYmdToLocalDate,
  toYmdLocal,
} from "@/lib/maintenance-recurrence";

function isYmd(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

async function softDeleteScheduleById(
  id: string,
  userId: string,
  meta: Record<string, unknown>
): Promise<boolean> {
  const live = await db.query.maintenanceSchedules.findFirst({
    where: and(eq(maintenanceSchedules.id, id), isNull(maintenanceSchedules.deletedAt)),
  });
  if (!live) return false;
  await db
    .update(maintenanceSchedules)
    .set({ deletedAt: new Date() })
    .where(eq(maintenanceSchedules.id, id));
  await recordAuditLog({
    entityType: "maintenance_schedule",
    entityId: id,
    action: "soft_deleted",
    userId,
    metadata: { scheduleName: live.name, ...meta },
  });
  return true;
}

function isMissingAssigneeColumnError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("maintenance_schedules.assignee_id") &&
    (message.includes("no such column") || message.includes("has no column named"))
  );
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const row = await db.query.maintenanceSchedules.findFirst({
    where: and(eq(maintenanceSchedules.id, id), isNull(maintenanceSchedules.deletedAt)),
  });
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const hasName = body.name !== undefined;
  const hasRecurrence = body.frequency !== undefined;
  const hasChecklist = body.checklistTemplateId !== undefined;
  const hasAsset = body.assetId !== undefined;
  const hasColor = body.color !== undefined;
  const hasAssignees =
    body.assigneeIds !== undefined || body.assigneeId !== undefined;

  if (
    !hasName &&
    !hasRecurrence &&
    !hasChecklist &&
    !hasAsset &&
    !hasColor &&
    !hasAssignees
  ) {
    return NextResponse.json(
      { error: "Nada que actualizar" },
      { status: 400 }
    );
  }

  let nextName: string | undefined;
  if (hasName) {
    const trimmed = typeof body.name === "string" ? body.name.trim() : "";
    if (!trimmed) {
      return NextResponse.json(
        { error: "El nombre no puede estar vacío" },
        { status: 400 }
      );
    }
    nextName = trimmed;
  }

  let parsedRecurrence: { recurrence: string; nextRunAt: Date } | null = null;
  if (hasRecurrence) {
    const parsed = parseRecurrencePayloadFromMaintenanceBody(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    parsedRecurrence = {
      recurrence: parsed.recurrence,
      nextRunAt: parsed.nextRunAt,
    };
  }

  let nextChecklistId: string | null | undefined;
  if (hasChecklist) {
    if (body.checklistTemplateId === null || body.checklistTemplateId === "") {
      nextChecklistId = null;
    } else {
      const tid = String(body.checklistTemplateId).trim();
      const t = await db.query.checklistTemplates.findFirst({
        where: eq(checklistTemplates.id, tid),
      });
      if (!t) {
        return NextResponse.json(
          { error: "Plantilla de checklist no encontrada" },
          { status: 400 }
        );
      }
      nextChecklistId = tid;
    }
  }

  let nextAssetId: string | null | undefined;
  if (hasAsset) {
    if (body.assetId === null || body.assetId === "") {
      nextAssetId = null;
    } else {
      const aid = String(body.assetId).trim();
      const a = await db.query.assets.findFirst({
        where: eq(assets.id, aid),
      });
      if (!a) {
        return NextResponse.json({ error: "Activo no encontrado" }, { status: 400 });
      }
      nextAssetId = aid;
    }
  }

  let nextColor: string | undefined;
  if (hasColor) {
    const colorRaw =
      typeof body.color === "string" ? body.color.trim().toUpperCase() : "";
    if (!/^#[0-9A-F]{6}$/.test(colorRaw)) {
      return NextResponse.json({ error: "Color no válido" }, { status: 400 });
    }
    nextColor = colorRaw;
  }

  let assigneeIdsUpdate: string[] | undefined;
  if (body.assigneeIds !== undefined) {
    if (!Array.isArray(body.assigneeIds)) {
      return NextResponse.json(
        { error: "assigneeIds inválido" },
        { status: 400 }
      );
    }
    assigneeIdsUpdate = Array.from(
      new Set(
        body.assigneeIds
          .map((x: unknown) => String(x).trim())
          .filter(Boolean)
      )
    );
    for (const uid of assigneeIdsUpdate) {
      const u = await db.query.users.findFirst({
        where: eq(users.id, uid),
        columns: { id: true },
      });
      if (!u) {
        return NextResponse.json(
          { error: "Usuario no encontrado" },
          { status: 400 }
        );
      }
    }
  } else if (body.assigneeId !== undefined) {
    assigneeIdsUpdate =
      body.assigneeId === null || body.assigneeId === ""
        ? []
        : [String(body.assigneeId)];
    if (assigneeIdsUpdate.length) {
      const u = await db.query.users.findFirst({
        where: eq(users.id, assigneeIdsUpdate[0]!),
        columns: { id: true },
      });
      if (!u) {
        return NextResponse.json(
          { error: "Usuario no encontrado" },
          { status: 400 }
        );
      }
    }
  }

  const setPayload: {
    name?: string;
    recurrence?: string;
    nextRunAt?: Date;
    checklistTemplateId?: string | null;
    assetId?: string | null;
    color?: string;
  } = {};
  if (nextName !== undefined) setPayload.name = nextName;
  if (parsedRecurrence) {
    setPayload.recurrence = parsedRecurrence.recurrence;
    setPayload.nextRunAt = parsedRecurrence.nextRunAt;
  }
  if (nextChecklistId !== undefined) {
    setPayload.checklistTemplateId = nextChecklistId;
  }
  if (nextAssetId !== undefined) {
    setPayload.assetId = nextAssetId;
  }
  if (nextColor !== undefined) {
    setPayload.color = nextColor;
  }

  if (Object.keys(setPayload).length > 0) {
    await db
      .update(maintenanceSchedules)
      .set(setPayload)
      .where(eq(maintenanceSchedules.id, id));
  }

  if (assigneeIdsUpdate !== undefined) {
    try {
      await setMaintenanceScheduleAssigneeIds(id, assigneeIdsUpdate);
    } catch (error) {
      if (isMissingAssigneeColumnError(error)) {
        return NextResponse.json(
          {
            error:
              "No se puede actualizar responsables: falta soporte en la base de datos.",
          },
          { status: 409 }
        );
      }
      throw error;
    }
  }

  await recordAuditLog({
    entityType: "maintenance_schedule",
    entityId: id,
    action: "updated",
    userId: session.id,
    metadata: {
      scheduleName: nextName ?? row.name,
      changed: {
        name: hasName,
        recurrence: hasRecurrence,
        checklistTemplateId: hasChecklist,
        assetId: hasAsset,
        color: hasColor,
        assignees: assigneeIdsUpdate !== undefined,
      },
    },
  });

  const out: Record<string, unknown> = { ok: true };
  if (nextName !== undefined) out.name = nextName;
  if (parsedRecurrence) {
    out.recurrence = parsedRecurrence.recurrence;
    out.nextRunAt = parsedRecurrence.nextRunAt.toISOString();
  }
  if (nextChecklistId !== undefined) out.checklistTemplateId = nextChecklistId;
  if (nextAssetId !== undefined) out.assetId = nextAssetId;
  if (nextColor !== undefined) out.color = nextColor;

  return NextResponse.json(out);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const row = await db.query.maintenanceSchedules.findFirst({
    where: and(eq(maintenanceSchedules.id, id), isNull(maintenanceSchedules.deletedAt)),
  });
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") ?? "all";
  const date = url.searchParams.get("date");

  if (scope === "single" && date) {
    const rule = parseRecurrence(row.recurrence);
    if (!rule || rule.frequency === "none") {
      await softDeleteScheduleById(id, session.id, {
        reason: "single_non_recurring",
      });
      return NextResponse.json({
        ok: true,
        deleted: "single-as-series",
        canRestore: true,
      });
    }

    const beforeRecurrence = row.recurrence;
    const beforeNextRunAt = row.nextRunAt;

    const excluded = new Set(rule.excludedDates ?? []);
    excluded.add(date);
    const nextRule = { ...rule, excludedDates: Array.from(excluded) };
    const recurrence = buildRecurrenceJson(nextRule);

    const probeStart = parseYmdToLocalDate(date);
    const probeEnd = new Date(probeStart);
    probeEnd.setFullYear(probeEnd.getFullYear() + 5);
    const next = expandOccurrencesInRange(nextRule, probeStart, probeEnd)[0] ?? null;

    await db
      .update(maintenanceSchedules)
      .set({ recurrence, nextRunAt: next })
      .where(eq(maintenanceSchedules.id, id));

    await recordAuditLog({
      entityType: "maintenance_schedule",
      entityId: id,
      action: "occurrence_deleted",
      userId: session.id,
      metadata: {
        scheduleName: row.name,
        date,
        beforeRecurrence,
        beforeNextRunAt: beforeNextRunAt ? beforeNextRunAt.toISOString() : null,
      },
    });

    return NextResponse.json({
      ok: true,
      deleted: "single",
      canUndoRecurrence: true,
    });
  }

  if (scope === "future" && date && isYmd(date)) {
    const rule = parseRecurrence(row.recurrence);
    if (!rule || rule.frequency === "none") {
      await softDeleteScheduleById(id, session.id, {
        reason: "truncate_future_none_or_invalid",
        fromDate: date,
      });
      return NextResponse.json({
        ok: true,
        deleted: "all",
        canRestore: true,
      });
    }

    const lastKeep = lastOccurrenceStrictlyBefore(rule, date);
    if (!lastKeep) {
      await softDeleteScheduleById(id, session.id, {
        reason: "truncate_future_no_past_occurrences",
        fromDate: date,
      });
      return NextResponse.json({
        ok: true,
        deleted: "all",
        canRestore: true,
      });
    }

    const beforeRecurrence = row.recurrence;
    const beforeNextRunAt = row.nextRunAt;

    const untilYmd = toYmdLocal(lastKeep);
    const excludedFiltered = (rule.excludedDates ?? []).filter((d) => d <= untilYmd);
    const nextRule = {
      ...rule,
      until: untilYmd,
      excludedDates:
        excludedFiltered.length > 0 ? excludedFiltered : undefined,
    };
    const recurrence = buildRecurrenceJson(nextRule);
    const next = nextScheduledOccurrenceOnOrAfter(nextRule, new Date());

    await db
      .update(maintenanceSchedules)
      .set({ recurrence, nextRunAt: next })
      .where(eq(maintenanceSchedules.id, id));

    await recordAuditLog({
      entityType: "maintenance_schedule",
      entityId: id,
      action: "series_future_truncated",
      userId: session.id,
      metadata: {
        scheduleName: row.name,
        fromDate: date,
        until: untilYmd,
        beforeRecurrence,
        beforeNextRunAt: beforeNextRunAt ? beforeNextRunAt.toISOString() : null,
      },
    });

    return NextResponse.json({
      ok: true,
      deleted: "future",
      canUndoRecurrence: true,
    });
  }

  await softDeleteScheduleById(id, session.id, { reason: "delete_all" });
  return NextResponse.json({
    ok: true,
    deleted: "all",
    canRestore: true,
  });
}
