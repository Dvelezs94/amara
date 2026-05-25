import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getChecklistTemplateById } from "@/lib/checklist-templates";
import { checklistItemDepth, flattenChecklistTreeForDisplay } from "@/lib/checklist-item-tree";
import { ChecklistGroupedList } from "@/components/ChecklistGroupedList";
import { PrintChecklistButton } from "./PrintChecklistButton";

export default async function ChecklistTemplatePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: Promise<{ notice?: string; mode?: string; draftRevisionId?: string; source?: string }>;
}) {
  const { id } = params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  if (
    resolvedSearchParams?.mode === "edit" ||
    Boolean(resolvedSearchParams?.draftRevisionId?.trim()) ||
    resolvedSearchParams?.source === "live"
  ) {
    const draft = resolvedSearchParams?.draftRevisionId?.trim();
    if (draft) {
      redirect(`/checklists/${id}/revisions/${draft}/edit`);
    }
    redirect(`/checklists/${id}/revisions`);
  }

  const session = await getSession();
  const template = await getChecklistTemplateById(id);
  if (!template) notFound();

  const notice = resolvedSearchParams?.notice;
  const checklistRows = template.items ?? [];
  const checklistTreeRows = checklistRows.map((r) => ({
    id: r.id,
    parentItemId: r.parentItemId ?? null,
    sortOrder: r.sortOrder,
    type: r.type,
    label: r.label,
    fieldType: r.fieldType,
    options: r.options,
  }));
  const checklistFlat = flattenChecklistTreeForDisplay(checklistTreeRows);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-zinc-900">Plantilla publicada</h1>
        <PrintChecklistButton targetId="checklist-visualization" />
      </div>
      {notice === "revision_submitted" && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Revisión enviada. Esta propuesta requiere revisión y aprobación de calidad. Puedes seguir el
          estado en la pestaña{" "}
          <Link href={`/checklists/${id}/revisions`} className="font-medium text-amber-900 underline">
            Revisiones
          </Link>
          .
        </p>
      )}
      {notice === "draft_saved" && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Borrador guardado. Continúa en{" "}
          <Link href={`/checklists/${id}/revisions`} className="font-medium text-emerald-900 underline">
            Revisiones
          </Link>
          .
        </p>
      )}
      {session?.role === "calidad" && (
        <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
          Tu rol solo puede revisar y aprobar cambios. Abre la pestaña{" "}
          <Link href={`/checklists/${id}/revisions`} className="font-medium text-primary-700 underline">
            Revisiones
          </Link>{" "}
          para ver propuestas pendientes.
        </p>
      )}

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
          <ChecklistGroupedList
            flat={checklistFlat}
            all={checklistTreeRows}
            className="mt-3 space-y-5"
            collapseContextKey={id}
            renderItem={(item, { insideSection }) => {
              const depth = checklistItemDepth(
                { id: item.id, parentItemId: item.parentItemId ?? null },
                checklistTreeRows
              );
              const padStyle = { paddingLeft: Math.min(depth, 8) * 16 };
              const rowPad = insideSection ? "px-4 py-3" : "py-3";
              return (
              <li key={item.id} style={padStyle} className={rowPad}>
                {item.type === "text_block" ? (
                  <div>
                    {item.fieldType === "title" ? (
                      <h3 className="text-lg font-semibold text-zinc-900">{item.label}</h3>
                    ) : item.fieldType === "subtitle" ? (
                      <h4 className="text-base font-semibold text-zinc-800">{item.label}</h4>
                    ) : (
                      <p className="text-sm leading-relaxed text-zinc-700">{item.label}</p>
                    )}
                  </div>
                ) : item.type === "step" ? (
                  <div className="flex items-center gap-2 py-3 text-zinc-900">
                    <input
                      type="checkbox"
                      disabled
                      checked={false}
                      className="h-4 w-4 rounded border-zinc-300 text-primary-600 accent-primary-600"
                    />
                    <span className="text-zinc-900">{item.label}</span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5 py-3 text-zinc-900">
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
                        className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-500 shadow-sm"
                      />
                    )}
                    {item.fieldType === "number" && (
                      <input
                        type="number"
                        disabled
                        value=""
                        placeholder="0"
                        className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-500 shadow-sm"
                      />
                    )}
                    {item.fieldType === "date" && (
                      <input
                        type="date"
                        disabled
                        value=""
                        className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-500 shadow-sm"
                      />
                    )}
                    {item.fieldType === "dropdown" && (
                      <select
                        disabled
                        value=""
                        className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-500 shadow-sm"
                      >
                        <option value="">Seleccionar…</option>
                        {(Array.isArray(item.options) ? item.options : []).map((opt: string) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    )}
                    {item.fieldType === "photo" && (
                      <input
                        type="file"
                        disabled
                        className="text-sm text-zinc-400 file:mr-2 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-500"
                      />
                    )}
                  </div>
                )}
              </li>
              );
            }}
          />
        </div>
      </div>
    </div>
  );
}
