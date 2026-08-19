import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { workflowDefinitions, workflowRuns } from "@/lib/db/schema";
import { recordAuditLog } from "@/lib/audit";
import { parseWorkflowDefinition } from "@/lib/workflows";

function requireAdmin(session: { role: string } | null) {
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const denied = requireAdmin(session);
  if (denied) return denied;

  const { id } = await params;
  const row = await db.query.workflowDefinitions.findFirst({
    where: eq(workflowDefinitions.id, id),
  });
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const includeRuns = url.searchParams.get("runs") === "1";
  let runs: {
    id: string;
    status: string;
    error: string | null;
    createdAt: Date;
    triggerType: string;
    entityId: string | null;
  }[] = [];
  if (includeRuns) {
    runs = await db
      .select({
        id: workflowRuns.id,
        status: workflowRuns.status,
        error: workflowRuns.error,
        createdAt: workflowRuns.createdAt,
        triggerType: workflowRuns.triggerType,
        entityId: workflowRuns.entityId,
      })
      .from(workflowRuns)
      .where(eq(workflowRuns.workflowId, id))
      .orderBy(desc(workflowRuns.createdAt))
      .limit(20);
  }

  return NextResponse.json({ ...row, runs });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const denied = requireAdmin(session);
  if (denied) return denied;

  const { id } = await params;
  const existing = await db.query.workflowDefinitions.findFirst({
    where: eq(workflowDefinitions.id, id),
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const onlyEnabled =
    body.enabled !== undefined &&
    body.name === undefined &&
    body.triggerType === undefined &&
    body.actions === undefined;

  if (onlyEnabled) {
    const enabled = body.enabled !== false;
    await db
      .update(workflowDefinitions)
      .set({ enabled, updatedAt: new Date() })
      .where(eq(workflowDefinitions.id, id));
    await recordAuditLog({
      entityType: "workflow_definition",
      entityId: id,
      action: enabled ? "enabled" : "disabled",
      userId: session!.id,
      metadata: { name: existing.name },
    });
    return NextResponse.json({ ok: true, enabled });
  }

  const parsed = parseWorkflowDefinition({
    name: body.name ?? existing.name,
    description:
      body.description !== undefined ? body.description : existing.description,
    enabled: body.enabled !== undefined ? body.enabled : existing.enabled,
    triggerType: body.triggerType ?? existing.triggerType,
    triggerConfig:
      body.triggerConfig !== undefined
        ? body.triggerConfig
        : existing.triggerConfig,
    actions: body.actions ?? existing.actions,
  });
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  await db
    .update(workflowDefinitions)
    .set({
      name: parsed.value.name,
      description: parsed.value.description || null,
      enabled: parsed.value.enabled,
      triggerType: parsed.value.triggerType,
      triggerConfig: parsed.value.triggerConfig,
      actions: parsed.value.actions,
      updatedAt: new Date(),
    })
    .where(eq(workflowDefinitions.id, id));

  await recordAuditLog({
    entityType: "workflow_definition",
    entityId: id,
    action: "updated",
    userId: session!.id,
    metadata: { name: parsed.value.name },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const denied = requireAdmin(session);
  if (denied) return denied;

  const { id } = await params;
  const existing = await db.query.workflowDefinitions.findFirst({
    where: eq(workflowDefinitions.id, id),
    columns: { id: true, name: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.delete(workflowDefinitions).where(eq(workflowDefinitions.id, id));
  await recordAuditLog({
    entityType: "workflow_definition",
    entityId: id,
    action: "deleted",
    userId: session!.id,
    metadata: { name: existing.name },
  });
  return NextResponse.json({ ok: true });
}
