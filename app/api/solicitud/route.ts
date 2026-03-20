import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workOrders } from "@/lib/db/schema";
import { createId } from "@/lib/id";
import { recordAuditLog } from "@/lib/audit";
import { getNextWorkOrderFolio } from "@/lib/work-order-folio";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const titulo = (body.titulo ?? "").trim();
  const descripcion = (body.descripcion ?? "").trim();
  const prioridadRaw = String(body.prioridad ?? "medium").trim();
  const prioridad =
    prioridadRaw === "low" ||
    prioridadRaw === "medium" ||
    prioridadRaw === "high" ||
    prioridadRaw === "urgent"
      ? prioridadRaw
      : "medium";
  const nombreContacto = (body.nombreContacto ?? "").trim();
  const emailContacto = (body.emailContacto ?? "").trim().toLowerCase();

  if (!titulo || !descripcion) {
    return NextResponse.json(
      { error: "Titulo y descripcion son obligatorios" },
      { status: 400 }
    );
  }

  const detalleContacto = [
    nombreContacto ? `Nombre contacto: ${nombreContacto}` : null,
    emailContacto ? `Email contacto: ${emailContacto}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const id = createId();
  const folio = await getNextWorkOrderFolio();
  const now = new Date();
  const finalDescription = detalleContacto
    ? `${descripcion}\n\n---\nSolicitud externa desde /solicitud\n${detalleContacto}`
    : `${descripcion}\n\n---\nSolicitud externa desde /solicitud`;

  await db.insert(workOrders).values({
    id,
    folio,
    title: titulo,
    description: finalDescription,
    status: "open",
    priority: prioridad,
    requesterId: null,
    createdAt: now,
    updatedAt: now,
  });

  await recordAuditLog({
    entityType: "work_order",
    entityId: id,
    action: "created_from_public_form",
    userId: null,
    metadata: {
      source: "/solicitud",
      title: titulo,
      priority: prioridad,
      hasContact: Boolean(nombreContacto || emailContacto),
    },
  });

  return NextResponse.json({ ok: true, workOrderId: id, folio });
}
