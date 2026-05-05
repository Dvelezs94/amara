import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { and, desc, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { getChecklistTemplateById } from "@/lib/checklist-templates";
import { db } from "@/lib/db";
import { checklistTemplateRevisions, users } from "@/lib/db/schema";
import { ChecklistTemplateForm } from "../ChecklistTemplateForm";
import { RevisionsPanel } from "./RevisionsPanel";

type Revision = {
  id: string;
  action: string;
  name: string;
  revisionNumber: number;
  status: string;
  createdAt: Date;
  userName: string | null;
  reviewComment: string | null;
  metadata: Record<string, unknown> | null;
};

async function getChecklistRevisions(id: string): Promise<Revision[]> {
  const rows = await db
    .select({
      id: checklistTemplateRevisions.id,
      action: checklistTemplateRevisions.status,
      name: checklistTemplateRevisions.name,
      revisionNumber: checklistTemplateRevisions.revisionNumber,
      status: checklistTemplateRevisions.status,
      createdAt: checklistTemplateRevisions.createdAt,
      userName: users.name,
      reviewComment: checklistTemplateRevisions.reviewComment,
      metadata: checklistTemplateRevisions.snapshot,
    })
    .from(checklistTemplateRevisions)
    .leftJoin(users, eq(checklistTemplateRevisions.proposedByUserId, users.id))
    .where(eq(checklistTemplateRevisions.checklistTemplateId, id))
    .orderBy(desc(checklistTemplateRevisions.revisionNumber))
    .limit(50);

  const mapped = rows.map((row) => ({
    id: row.id,
    action: row.action,
    name: row.name,
    revisionNumber: row.revisionNumber,
    status: row.status,
    createdAt: row.createdAt,
    userName: row.userName,
    reviewComment: row.reviewComment,
    metadata: row.metadata ?? null,
  }));
  if (mapped.length > 0) return mapped;

  const template = await getChecklistTemplateById(id);
  if (!template) return [];
  return [
    {
      id: "revision-0-virtual",
      action: "approved",
      name: "Revision 0",
      revisionNumber: 0,
      status: "approved",
      createdAt: template.createdAt,
      userName: null,
      reviewComment: null,
      metadata: {
        after: {
          name: template.name,
          description: template.description ?? null,
          items: (template.items ?? []).map((it) => ({
            type: it.type,
            label: it.label,
            fieldType: it.fieldType ?? null,
            options: Array.isArray(it.options) ? it.options : null,
          })),
        },
      },
    },
  ];
}

export default async function EditChecklistPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ mode?: string; notice?: string; draftRevisionId?: string; source?: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const wantsEditFromUrl =
    resolvedSearchParams?.mode === "edit" ||
    Boolean(resolvedSearchParams?.draftRevisionId?.trim()) ||
    resolvedSearchParams?.source === "live";
  if (session?.role === "supervisor" && wantsEditFromUrl) {
    redirect(`/checklists/${id}`);
  }
  const mode =
    session?.role === "supervisor"
      ? "view"
      : resolvedSearchParams?.mode === "edit"
        ? "edit"
        : "view";
  const notice = resolvedSearchParams?.notice;
  const draftRevisionId = resolvedSearchParams?.draftRevisionId?.trim();
  const source = resolvedSearchParams?.source;
  const forceLiveTemplate = mode === "edit" && source === "live";
  const template = await getChecklistTemplateById(id);
  if (!template) notFound();
  const draftRevision =
    session?.role === "admin" && mode === "edit" && !forceLiveTemplate
      ? await db.query.checklistTemplateRevisions.findFirst({
          where: and(
            eq(checklistTemplateRevisions.checklistTemplateId, id),
            eq(checklistTemplateRevisions.proposedByUserId, session.id),
            eq(checklistTemplateRevisions.status, "draft"),
            draftRevisionId
              ? eq(checklistTemplateRevisions.id, draftRevisionId)
              : eq(checklistTemplateRevisions.checklistTemplateId, id)
          ),
          orderBy: [desc(checklistTemplateRevisions.createdAt)],
        })
      : null;
  const wantsDraftEdit = mode === "edit" && Boolean(draftRevision);
  const draftAfter = draftRevision?.snapshot?.after;
  const initialForEdit =
    draftAfter && typeof draftAfter === "object"
      ? {
          name:
            typeof draftAfter.name === "string" ? draftAfter.name : template.name,
          description:
            typeof draftAfter.description === "string" || draftAfter.description === null
              ? draftAfter.description
              : template.description ?? null,
          items: Array.isArray(draftAfter.items)
            ? draftAfter.items.map((item) => ({
                type: String(item.type ?? "custom_field"),
                label: String(item.label ?? ""),
                fieldType: item.fieldType ? String(item.fieldType) : null,
                options: Array.isArray(item.options) ? item.options.map((opt) => String(opt)) : null,
              }))
            : template.items,
        }
      : template;
  const revisions = await getChecklistRevisions(id);
  const revisionsForClient = revisions.map((rev) => ({
    ...rev,
    createdAt: rev.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-4 lg:pr-[376px]">
      <nav className="flex flex-wrap items-center gap-1 text-sm text-zinc-500" aria-label="Migas de pan">
        <Link
          href="/checklists"
          className="inline-flex items-center gap-1 font-medium text-[#F14C03] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Checklist
        </Link>
        <span aria-hidden className="text-zinc-400">
          /
        </span>
        <span className="text-zinc-600">{template.name}</span>
      </nav>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-zinc-900">
          {mode === "edit" ? "Edicion de revision de checklist" : "Plantilla de checklist"}
        </h1>
      </div>
      {notice === "revision_submitted" && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Revisión enviada. Esta propuesta requiere revisión y aprobación de un supervisor.
        </p>
      )}
      {notice === "draft_saved" && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Cambios guardados como borrador. No se aplican hasta ser aprobados.
        </p>
      )}
      {mode === "edit" && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
          {wantsDraftEdit && draftRevision ? (
            <>
              <p>
                Editando borrador no enviado: <span className="font-semibold">{draftRevision.name}</span>
              </p>
            </>
          ) : (
            <p>Editando version actual de la plantilla</p>
          )}
        </div>
      )}

      <section className="min-w-0 lg:pr-4">
        {mode === "edit" ? (
          <ChecklistTemplateForm
            templateId={id}
            initial={wantsDraftEdit ? initialForEdit : template}
            initialRevisionName={wantsDraftEdit ? draftRevision?.name : undefined}
            draftRevisionId={wantsDraftEdit ? draftRevision?.id : undefined}
          />
        ) : (
          <div id="checklist-visualization" className="space-y-4">
              <div className="rounded-xl border border-zinc-200 bg-white p-4">
                <h2 className="text-sm font-medium text-zinc-500">Nombre</h2>
                <p className="mt-1 text-zinc-900">{template.name}</p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-4">
                <h2 className="text-sm font-medium text-zinc-500">Descripción</h2>
                <p className="mt-1 text-zinc-900">{template.description || "Sin descripción"}</p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-4">
                <h2 className="text-sm font-medium text-zinc-500">Elementos</h2>
                <ul className="mt-2 space-y-2">
                  {template.items?.map((item, idx) => (
                    <li key={`${item.label}-${idx}`}>
                      {item.type === "text_block" ? (
                        <div className="px-1 py-1">
                          {item.fieldType === "title" ? (
                            <h3 className="text-lg font-semibold text-zinc-900">{item.label}</h3>
                          ) : item.fieldType === "subtitle" ? (
                            <h4 className="text-base font-semibold text-zinc-800">{item.label}</h4>
                          ) : (
                            <p className="text-sm leading-relaxed text-zinc-700">{item.label}</p>
                          )}
                        </div>
                      ) : item.type === "step" ? (
                        <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-zinc-900">
                          <input
                            type="checkbox"
                            disabled
                            checked={false}
                            className="h-4 w-4 rounded border-zinc-300 text-primary-600 accent-primary-600"
                          />
                          <span className="text-zinc-900">{item.label}</span>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-zinc-900">
                          <label className="text-sm font-medium text-zinc-700">{item.label}</label>
                          {item.fieldType === "checkbox" && (
                            <div className="self-start">
                              <label className="inline-flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  disabled
                                  checked={false}
                                  className="h-4 w-4 shrink-0 rounded border-zinc-300 text-primary-600 accent-primary-600"
                                />
                                <span className="text-sm text-zinc-500">Marcar si aplica</span>
                              </label>
                            </div>
                          )}
                          {item.fieldType === "text" && (
                            <input
                              type="text"
                              disabled
                              value=""
                              placeholder="Escribir valor"
                              className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-zinc-500"
                            />
                          )}
                          {item.fieldType === "number" && (
                            <input
                              type="number"
                              disabled
                              value=""
                              placeholder="0"
                              className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-zinc-500"
                            />
                          )}
                          {item.fieldType === "date" && (
                            <input
                              type="date"
                              disabled
                              value=""
                              className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-zinc-500"
                            />
                          )}
                          {item.fieldType === "dropdown" && (
                            <select
                              disabled
                              value=""
                              className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-zinc-500"
                            >
                              <option value="">Seleccionar…</option>
                              {(Array.isArray(item.options) ? item.options : []).map(
                                (opt: string) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                )
                              )}
                            </select>
                          )}
                          {item.fieldType === "photo" && (
                            <input
                              type="file"
                              disabled
                              className="text-sm text-zinc-400 file:mr-2 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-500"
                            />
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
          </div>
        )}
      </section>

      <div className="lg:hidden">
        <RevisionsPanel
          revisions={revisionsForClient}
          checklistId={id}
          mode={mode}
          canReview={session?.role === "supervisor"}
          allowEdit={session?.role !== "supervisor"}
        />
      </div>

      <div className="!mt-0 hidden lg:fixed lg:right-0 lg:top-16 lg:block lg:h-[calc(100vh-4rem)] lg:w-[360px] lg:bg-zinc-50">
        <RevisionsPanel
          revisions={revisionsForClient}
          checklistId={id}
          mode={mode}
          canReview={session?.role === "supervisor"}
          allowEdit={session?.role !== "supervisor"}
        />
      </div>
    </div>
  );
}
