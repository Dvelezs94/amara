import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { workflowDefinitions } from "@/lib/db/schema";
import { recordAuditLog } from "@/lib/audit";
import { createId } from "@/lib/id";
import { parseWorkflowDefinition } from "@/lib/workflows";

function requireAdmin(session: { role: string } | null) {
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const session = await getSession();
  const denied = requireAdmin(session);
  if (denied) return denied;

  const rows = await db
    .select({
      id: workflowDefinitions.id,
      name: workflowDefinitions.name,
      description: workflowDefinitions.description,
      enabled: workflowDefinitions.enabled,
      triggerType: workflowDefinitions.triggerType,
      triggerConfig: workflowDefinitions.triggerConfig,
      actions: workflowDefinitions.actions,
      updatedAt: workflowDefinitions.updatedAt,
      createdAt: workflowDefinitions.createdAt,
    })
    .from(workflowDefinitions)
    .orderBy(desc(workflowDefinitions.updatedAt));

  return NextResponse.json(
    rows.map((row) => ({
      ...row,
      actionCount: Array.isArray(row.actions) ? row.actions.length : 0,
    }))
  );
}

export async function POST(req: Request) {
  const session = await getSession();
  const denied = requireAdmin(session);
  if (denied) return denied;

  const body = (await req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }
  const parsed = parseWorkflowDefinition(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const id = createId();
  await db.insert(workflowDefinitions).values({
    id,
    name: parsed.value.name,
    description: parsed.value.description || null,
    enabled: parsed.value.enabled,
    triggerType: parsed.value.triggerType,
    triggerConfig: parsed.value.triggerConfig,
    actions: parsed.value.actions,
    createdByUserId: session!.id,
  });

  await recordAuditLog({
    entityType: "workflow_definition",
    entityId: id,
    action: "created",
    userId: session!.id,
    metadata: {
      name: parsed.value.name,
      triggerType: parsed.value.triggerType,
    },
  });

  return NextResponse.json({ id }, { status: 201 });
}
