import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workOrders } from "@/lib/db/schema";
import { createId } from "@/lib/id";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const titulo = (body.titulo ?? "").trim();
  const descripcion = (body.descripcion ?? "").trim();
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
  const now = new Date();
  const finalDescription = detalleContacto
    ? `${descripcion}\n\n---\nSolicitud externa desde /solicitud\n${detalleContacto}`
    : `${descripcion}\n\n---\nSolicitud externa desde /solicitud`;

  await db.insert(workOrders).values({
    id,
    title: titulo,
    description: finalDescription,
    status: "open",
    priority: "medium",
    requesterId: null,
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json({ ok: true, workOrderId: id });
}
