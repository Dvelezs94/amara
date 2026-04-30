import { and, desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { attachments, notes, users, workOrders } from "@/lib/db/schema";
import { createId } from "@/lib/id";
import { recordAuditLog } from "@/lib/audit";
import { getNextWorkOrderFolio } from "@/lib/work-order-folio";
import { publicWebWorkOrderFilter } from "@/lib/public-web-work-order-filter";
import {
  buildPublicAttachmentUrlMaps,
  extractInlineFilesFromRewrittenNote,
  rewriteNoteBodyToPublicDownloadUrls,
} from "@/lib/solicitud-public-note-urls";

/** Public lookup by folio: solo ordenes desde formulario publico; sin id interno; adjuntos con `?folio=`. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("folio")?.trim() ?? "";
  if (!raw) {
    return NextResponse.json({ error: "Indica el folio de la orden." }, { status: 400 });
  }
  const folio = Number(raw);
  if (!Number.isInteger(folio) || folio < 1) {
    return NextResponse.json({ error: "Folio no valido." }, { status: 400 });
  }

  const [wo] = await db
    .select({
      id: workOrders.id,
      folio: workOrders.folio,
      title: workOrders.title,
      status: workOrders.status,
      priority: workOrders.priority,
      kind: workOrders.kind,
      createdAt: workOrders.createdAt,
      dueDate: workOrders.dueDate,
      startedAt: workOrders.startedAt,
      completedAt: workOrders.completedAt,
    })
    .from(workOrders)
    .where(and(eq(workOrders.folio, folio), publicWebWorkOrderFilter))
    .limit(1);

  if (!wo) {
    return NextResponse.json(
      { error: "No se encontro una orden con ese folio." },
      { status: 404 }
    );
  }

  const attachmentRows = await db.query.attachments.findMany({
    where: eq(attachments.workOrderId, wo.id),
    columns: { id: true, fileUrl: true, filename: true },
    orderBy: [desc(attachments.createdAt)],
  });
  const { byId, byUrl } = buildPublicAttachmentUrlMaps(attachmentRows, folio);

  const noteRows = await db.query.notes.findMany({
    where: eq(notes.workOrderId, wo.id),
    orderBy: [desc(notes.createdAt)],
  });

  const uniqueUserIds = Array.from(new Set(noteRows.map((n) => n.userId)));
  const authorRows =
    uniqueUserIds.length > 0
      ? await db.query.users.findMany({
          where: inArray(users.id, uniqueUserIds),
          columns: { id: true, name: true },
        })
      : [];
  const authorNameById = new Map(authorRows.map((u) => [u.id, u.name]));

  const comments = noteRows.map((note) => {
    const rewritten = rewriteNoteBodyToPublicDownloadUrls(note.body, folio, byId, byUrl);
    const { text, files } = extractInlineFilesFromRewrittenNote(rewritten);
    return {
      id: note.id,
      createdAt: note.createdAt.toISOString(),
      authorName: authorNameById.get(note.userId) ?? "Usuario",
      text,
      inlineFiles: files,
    };
  });

  return NextResponse.json({
    folio: wo.folio,
    title: wo.title,
    status: wo.status,
    priority: wo.priority,
    kind: wo.kind,
    createdAt: wo.createdAt?.toISOString() ?? null,
    dueDate: wo.dueDate?.toISOString() ?? null,
    startedAt: wo.startedAt?.toISOString() ?? null,
    completedAt: wo.completedAt?.toISOString() ?? null,
    comments,
  });
}

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

  if (!titulo || !descripcion || !nombreContacto) {
    return NextResponse.json(
      { error: "Titulo, descripcion y nombre de contacto son obligatorios" },
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
    ? `${descripcion}\n\n---\nOrden publica desde /orden\n${detalleContacto}`
    : `${descripcion}\n\n---\nOrden publica desde /orden`;

  await db.insert(workOrders).values({
    id,
    folio,
    title: titulo,
    description: finalDescription,
    status: "pending",
    priority: prioridad,
    kind: "on_demand",
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
      source: "/orden",
      title: titulo,
      priority: prioridad,
      hasContact: Boolean(nombreContacto),
    },
  });

  return NextResponse.json({ ok: true, workOrderId: id, folio });
}
