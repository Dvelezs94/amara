"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2, GripVertical, ChevronDown } from "lucide-react";

const FIELD_TYPES = [
  { value: "text", label: "Texto" },
  { value: "number", label: "Número" },
  { value: "date", label: "Fecha" },
  { value: "dropdown", label: "Lista desplegable" },
  { value: "checkbox", label: "Casilla" },
  { value: "photo", label: "Foto" },
] as const;

const TEXT_STYLES = [
  { value: "paragraph", label: "Párrafo" },
  { value: "subtitle", label: "Subtítulo" },
  { value: "title", label: "Título" },
] as const;

function makeItemId() {
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

type Item = {
  id: string;
  parentItemId?: string | null;
  type: "step" | "custom_field" | "text_block" | "section";
  label: string;
  fieldType?: string;
  options?: string[];
  /** Solo campos personalizados. */
  isOptional?: boolean;
};

function serializeTemplateItems(items: Item[]) {
  return items.map((it) => {
    const meta = { id: it.id, parentItemId: it.parentItemId ?? null };
    if (it.type === "custom_field") {
      const rawOpts = it.fieldType === "dropdown" ? it.options : undefined;
      const options =
        rawOpts != null
          ? rawOpts.map((o) => String(o).trim()).filter((s) => s.length > 0)
          : undefined;
      return {
        ...meta,
        type: "custom_field" as const,
        label: it.label.trim() || "Campo",
        fieldType: it.fieldType ?? "text",
        options: it.fieldType === "dropdown" ? (options?.length ? options : undefined) : undefined,
        ...(it.isOptional ? { isOptional: true } : {}),
      };
    }
    if (it.type === "text_block") {
      return {
        ...meta,
        type: "text_block" as const,
        label: it.label.trim() || "Nuevo texto",
        fieldType:
          it.fieldType === "title" ||
          it.fieldType === "subtitle" ||
          it.fieldType === "paragraph"
            ? it.fieldType
            : "paragraph",
      };
    }
    if (it.type === "section") {
      return {
        ...meta,
        type: "section" as const,
        label: it.label.trim() || "Sección",
      };
    }
    return { ...meta, type: "step" as const, label: it.label.trim() || "Paso" };
  });
}

function isDescendantOf(item: Item, ancestorId: string, all: Item[]): boolean {
  let pid: string | null | undefined = item.parentItemId;
  while (pid) {
    if (pid === ancestorId) return true;
    pid = all.find((x) => x.id === pid)?.parentItemId ?? null;
  }
  return false;
}

function subtreeEndExclusive(items: Item[], rootIndex: number): number {
  const root = items[rootIndex]!;
  let end = rootIndex + 1;
  for (let j = rootIndex + 1; j < items.length; j++) {
    if (isDescendantOf(items[j]!, root.id, items)) end = j + 1;
    else break;
  }
  return end;
}

function insertAfterSubtree(items: Item[], sectionId: string): number {
  const idx = items.findIndex((x) => x.id === sectionId);
  if (idx < 0) return items.length;
  return subtreeEndExclusive(items, idx);
}

function itemDepth(item: Item, all: Item[]): number {
  let d = 0;
  let p: string | null | undefined = item.parentItemId;
  while (p) {
    d += 1;
    p = all.find((x) => x.id === p)?.parentItemId ?? null;
  }
  return d;
}

function collectIdsToRemove(items: Item[], rootId: string): Set<string> {
  const ids = new Set<string>([rootId]);
  let growing = true;
  while (growing) {
    growing = false;
    for (const it of items) {
      if (ids.has(it.id)) continue;
      if (it.parentItemId && ids.has(it.parentItemId)) {
        ids.add(it.id);
        growing = true;
      }
    }
  }
  return ids;
}

function moveSubtree(prev: Item[], fromIndex: number, toIndex: number): Item[] {
  const fromEnd = subtreeEndExclusive(prev, fromIndex);
  if (toIndex > fromIndex && toIndex < fromEnd) return prev;
  const block = prev.slice(fromIndex, fromEnd);
  const rest = [...prev.slice(0, fromIndex), ...prev.slice(fromEnd)];
  let insertAt = toIndex;
  if (toIndex > fromIndex) insertAt -= block.length;
  insertAt = Math.max(0, Math.min(insertAt, rest.length));
  return [...rest.slice(0, insertAt), ...block, ...rest.slice(insertAt)];
}

export function ChecklistTemplateForm({
  templateId,
  initial,
  initialRevisionName,
  draftRevisionId,
  defaultFolderId,
  cancelHref,
  revisionsHubHref,
}: {
  templateId?: string;
  defaultFolderId?: string;
  initial?: {
    name: string;
    description?: string | null;
    items?: {
      id?: string;
      parentItemId?: string | null;
      type: string;
      label: string;
      fieldType?: string | null;
      options?: string[] | null | unknown;
      isOptional?: boolean;
    }[];
  };
  initialRevisionName?: string;
  draftRevisionId?: string;
  /** Defaults to `/checklists/{id}` or `/checklists` */
  cancelHref?: string;
  /** Where to send after submit (hub). Defaults to `/checklists/{id}/revisions` when templateId set */
  revisionsHubHref?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitAction, setSubmitAction] = useState<"save" | "submit_review">("save");
  const [showSubmitMenu, setShowSubmitMenu] = useState(false);
  const submitMenuRef = useRef<HTMLDivElement | null>(null);
  const [revisionName, setRevisionName] = useState(initialRevisionName ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [items, setItems] = useState<Item[]>(() =>
    (initial?.items ?? []).map((i) => {
      const type: Item["type"] =
        i.type === "custom_field" ||
        i.type === "text_block" ||
        i.type === "step" ||
        i.type === "section"
          ? i.type
          : "step";
      const raw = i as { id?: string; parentItemId?: string | null };
      const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : makeItemId();
      const parentItemId =
        typeof raw.parentItemId === "string" && raw.parentItemId.trim()
          ? raw.parentItemId.trim()
          : null;
      const base: Item = { id, type, label: i.label, parentItemId };
      if (type === "custom_field") {
        return {
          ...base,
          fieldType: i.fieldType ?? "text",
          options: Array.isArray(i.options) ? (i.options as string[]).map((o) => String(o)) : [],
          isOptional: Boolean((i as { isOptional?: unknown }).isOptional),
        };
      }
      if (type === "text_block") {
        return { ...base, fieldType: i.fieldType ?? "paragraph" };
      }
      if (type === "section") {
        return { ...base, parentItemId: null };
      }
      return base;
    })
  );
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  function addStep() {
    setItems((prev) => [
      ...prev,
      { id: makeItemId(), type: "text_block", label: "", fieldType: "paragraph", parentItemId: null },
    ]);
  }

  function addCustomField() {
    setItems((prev) => [
      ...prev,
      {
        id: makeItemId(),
        type: "custom_field",
        label: "",
        fieldType: "number",
        parentItemId: null,
        isOptional: false,
      },
    ]);
  }

  function addSection() {
    setItems((prev) => [...prev, { id: makeItemId(), type: "section", label: "", parentItemId: null }]);
  }

  function addStepUnderSection(sectionId: string) {
    setItems((prev) => {
      const pos = insertAfterSubtree(prev, sectionId);
      const row: Item = {
        id: makeItemId(),
        type: "text_block",
        label: "",
        fieldType: "paragraph",
        parentItemId: sectionId,
      };
      return [...prev.slice(0, pos), row, ...prev.slice(pos)];
    });
  }

  function addFieldUnderSection(sectionId: string) {
    setItems((prev) => {
      const pos = insertAfterSubtree(prev, sectionId);
      const row: Item = {
        id: makeItemId(),
        type: "custom_field",
        label: "",
        fieldType: "number",
        parentItemId: sectionId,
        isOptional: false,
      };
      return [...prev.slice(0, pos), row, ...prev.slice(pos)];
    });
  }

  function moveItem(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;
    setItems((prev) => moveSubtree(prev, fromIndex, toIndex));
  }

  function handleDragStart(e: React.DragEvent, index: number) {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
    const li = (e.target as HTMLElement).closest("li");
    if (li) {
      e.dataTransfer.setDragImage(li, 0, 0);
    }
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropIndex(index);
  }

  function handleDrop(e: React.DragEvent, toIndex: number) {
    e.preventDefault();
    setDropIndex(null);
    const fromIndex = draggedIndex;
    setDraggedIndex(null);
    if (fromIndex == null || fromIndex === toIndex) return;
    const raw = e.dataTransfer.getData("text/plain");
    if (String(fromIndex) !== raw) return;
    moveItem(fromIndex, toIndex);
  }

  function handleDragEnd() {
    setDraggedIndex(null);
    setDropIndex(null);
  }

  function updateItem(index: number, updates: Partial<Item>) {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  }

  function removeItem(index: number) {
    setItems((prev) => {
      const id = prev[index]!.id;
      const drop = collectIdsToRemove(prev, id);
      return prev.filter((it) => !drop.has(it.id));
    });
  }

  function addDropdownOption(index: number) {
    setItems((prev) => {
      const next = [...prev];
      const it = next[index];
      if (it.type !== "custom_field") return prev;
      const opts = it.options ?? [];
      next[index] = { ...it, options: [...opts, ""] };
      return next;
    });
  }

  function updateDropdownOption(index: number, optIndex: number, value: string) {
    setItems((prev) => {
      const next = [...prev];
      const it = next[index];
      if (it.type !== "custom_field" || !it.options) return prev;
      const opts = [...it.options];
      opts[optIndex] = value;
      next[index] = { ...it, options: opts };
      return next;
    });
  }

  function removeDropdownOption(index: number, optIndex: number) {
    setItems((prev) => {
      const next = [...prev];
      const it = next[index];
      if (it.type !== "custom_field" || !it.options) return prev;
      next[index] = { ...it, options: it.options.filter((_, i) => i !== optIndex) };
      return next;
    });
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!submitMenuRef.current) return;
      if (!submitMenuRef.current.contains(event.target as Node)) {
        setShowSubmitMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function submitTemplate(requestedAction: "save" | "submit_review") {
    setSubmitAction(requestedAction);
    setError(null);
    setLoading(true);
    const nameTrim = name.trim();
    if (!nameTrim) {
      setError("El nombre es obligatorio");
      window.scrollTo({ top: 0, behavior: "smooth" });
      setLoading(false);
      return;
    }
    try {
      if (templateId) {
        const res = await fetch(`/api/checklist-templates/${templateId}/revisions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            submissionAction: requestedAction,
            draftRevisionId,
            revisionName: revisionName.trim() || "Sin nombre",
            name: nameTrim,
            description: description.trim() || null,
            items: serializeTemplateItems(items),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error ?? "No se pudo crear la revisión");
          window.scrollTo({ top: 0, behavior: "smooth" });
          setLoading(false);
          return;
        }
        const hub =
          revisionsHubHref?.trim() ||
          (templateId ? `/checklists/${templateId}/revisions` : "/checklists");
        if (data.status === "proposed") {
          window.scrollTo({ top: 0, behavior: "smooth" });
          if (requestedAction === "submit_review") {
            router.push(`${hub}?notice=revision_submitted`);
          } else {
            const revisionId = String(data.revisionId ?? draftRevisionId ?? "").trim();
            if (revisionId) {
              router.push(
                `/checklists/${templateId}/revisions/${revisionId}/edit?notice=revision_saved`
              );
            } else {
              router.push(`${hub}?notice=revision_submitted`);
            }
          }
        } else if (data.status === "draft") {
          const revisionId = String(data.revisionId ?? draftRevisionId ?? "").trim();
          if (revisionId) {
            router.push(`/checklists/${templateId}/revisions/${revisionId}/edit?notice=draft_saved`);
          } else {
            router.push(`${hub}?notice=draft_saved`);
          }
        } else {
          router.push(hub);
        }
      } else {
        const res = await fetch("/api/checklist-templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: nameTrim,
            description: description.trim() || null,
            ...(defaultFolderId?.trim()
              ? { folderId: defaultFolderId.trim() }
              : {}),
            items: serializeTemplateItems(items),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error ?? "Error al crear");
          window.scrollTo({ top: 0, behavior: "smooth" });
          setLoading(false);
          return;
        }
        const id = data.id;
        router.push(`/checklists/${id}`);
      }
      router.refresh();
    } catch {
      setError("Algo salió mal");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    setLoading(false);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await submitTemplate("save");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{error}</p>
      )}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-zinc-700 mb-1">
          Nombre de la plantilla *
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-zinc-700 mb-1">
          Descripción
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>
      {templateId && (
        <div>
          <label htmlFor="revisionName" className="block text-sm font-medium text-zinc-700 mb-1">
            Numero de revision *
          </label>
          <input
            id="revisionName"
            type="text"
            value={revisionName}
            onChange={(e) => setRevisionName(e.target.value)}
            placeholder="Ej. 5"
            required
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
      )}

      <div>
        <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-sm font-medium text-zinc-700">Elementos (pasos y campos)</h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              En cada sección usa «Texto en sección» o «Campo en sección» para anidar bloques de texto y campos
              dentro de esa sección.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 justify-end">
            <button
              type="button"
              onClick={addSection}
              className="text-sm text-primary-600 font-medium flex items-center gap-1"
            >
              <Plus className="h-4 w-4" />
              Sección
            </button>
            <span className="text-zinc-300" aria-hidden>
              |
            </span>
            <button
              type="button"
              onClick={addStep}
              className="text-sm text-primary-600 font-medium flex items-center gap-1"
            >
              <Plus className="h-4 w-4" />
              Texto
            </button>
            <span className="text-zinc-300" aria-hidden>
              |
            </span>
            <button
              type="button"
              onClick={addCustomField}
              className="text-sm text-primary-600 font-medium flex items-center gap-1"
            >
              <Plus className="h-4 w-4" /> Campo
            </button>
          </div>
        </div>
        <ul className="space-y-3">
          {items.map((item, index) => {
            const depth = itemDepth(item, items);
            return (
            <li
              key={item.id}
              style={{ marginLeft: Math.min(depth, 8) * 16 }}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={`flex gap-2 items-start rounded-lg border-2 p-3 transition-colors ${
                item.type === "section"
                  ? "border-primary-200 bg-primary-50/40"
                  : "bg-white border-zinc-200"
              } ${
                draggedIndex === index
                  ? "opacity-50 border-primary-300 cursor-grabbing"
                  : dropIndex === index && draggedIndex !== index
                    ? "border-primary-400 bg-primary-50/50"
                    : ""
              }`}
            >
              <div
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                className="shrink-0 mt-1 cursor-grab active:cursor-grabbing touch-none p-0.5 -m-0.5 rounded text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100"
                aria-label="Arrastrar para reordenar"
              >
                <GripVertical className="h-5 w-5" aria-hidden />
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <input
                  type="text"
                  value={item.label}
                  onChange={(e) => updateItem(index, { label: e.target.value })}
                  placeholder={
                    item.type === "section"
                      ? "Título de la sección"
                      : item.type === "step"
                        ? "Etiqueta del paso"
                        : item.type === "text_block"
                          ? "Texto estático"
                          : "Etiqueta del campo"
                  }
                  className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
                {item.type === "section" && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => addStepUnderSection(item.id)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary-700 hover:underline"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden />
                      Texto en sección
                    </button>
                    <button
                      type="button"
                      onClick={() => addFieldUnderSection(item.id)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary-700 hover:underline"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden />
                      Campo en sección
                    </button>
                  </div>
                )}
                {item.type === "custom_field" && (
                  <>
                    <select
                      value={item.fieldType ?? "text"}
                      onChange={(e) => updateItem(index, { fieldType: e.target.value })}
                      className="rounded-lg border border-zinc-300 px-2 py-1 text-sm text-zinc-900"
                    >
                      {FIELD_TYPES.map((ft) => (
                        <option key={ft.value} value={ft.value}>
                          {ft.label}
                        </option>
                      ))}
                    </select>
                    {item.fieldType === "dropdown" && (
                      <div className="space-y-1">
                        <p className="text-xs text-zinc-500">Opciones</p>
                        {(item.options ?? []).map((opt, oi) => (
                          <div key={oi} className="flex gap-1">
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => updateDropdownOption(index, oi, e.target.value)}
                              placeholder="Opción"
                              className="flex-1 rounded border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 placeholder:text-zinc-400"
                            />
                            <button
                              type="button"
                              onClick={() => removeDropdownOption(index, oi)}
                              className="p-1 text-zinc-500 hover:text-red-600"
                              aria-label="Quitar opción"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => addDropdownOption(index)}
                          className="text-xs text-primary-600"
                        >
                          + Añadir opción
                        </button>
                      </div>
                    )}
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-700">
                      <input
                        type="checkbox"
                        checked={item.isOptional === true}
                        onChange={(e) =>
                          updateItem(index, { isOptional: e.target.checked })
                        }
                        className="h-3.5 w-3.5 rounded border-zinc-300 text-primary-600"
                      />
                      Campo opcional (se puede dejar en blanco al ejecutar la tarea)
                    </label>
                  </>
                )}
                {item.type === "text_block" && (
                  <select
                    value={item.fieldType ?? "paragraph"}
                    onChange={(e) => updateItem(index, { fieldType: e.target.value })}
                    className="rounded-lg border border-zinc-300 px-2 py-1 text-sm text-zinc-900"
                  >
                    {TEXT_STYLES.map((style) => (
                      <option key={style.value} value={style.value}>
                        {style.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeItem(index)}
                className="p-1.5 text-zinc-500 hover:text-red-600 rounded tap-target"
                aria-label="Quitar elemento"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </li>
            );
          })}
        </ul>
        {items.length > 5 && (
          <div className="mt-3 flex justify-end">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 justify-end">
              <button
                type="button"
                onClick={addSection}
                className="text-sm text-primary-600 font-medium flex items-center gap-1"
              >
                <Plus className="h-4 w-4" />
                Sección
              </button>
              <span className="text-zinc-300" aria-hidden>
                |
              </span>
              <button
                type="button"
                onClick={addStep}
                className="text-sm text-primary-600 font-medium flex items-center gap-1"
              >
                <Plus className="h-4 w-4" />
                Texto
              </button>
              <span className="text-zinc-300" aria-hidden>
                |
              </span>
              <button
                type="button"
                onClick={addCustomField}
                className="text-sm text-primary-600 font-medium flex items-center gap-1"
              >
                <Plus className="h-4 w-4" /> Campo
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <div className="relative flex-1" ref={submitMenuRef}>
          {templateId ? (
            <div className="flex overflow-hidden rounded-xl border border-blue-700 bg-blue-600 shadow-sm">
              <button
                type="submit"
                disabled={loading}
                onClick={() => {
                  setSubmitAction("save");
                  setShowSubmitMenu(false);
                }}
                className="flex-1 bg-blue-600 px-4 py-3 font-medium text-white transition-colors hover:bg-blue-700 tap-target disabled:opacity-60"
              >
                {loading && submitAction === "save" ? "Guardando..." : "Guardar cambios"}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => setShowSubmitMenu((prev) => !prev)}
                className="flex w-11 items-center justify-center border-l border-blue-500 bg-blue-600 text-white transition-colors hover:bg-blue-700 tap-target disabled:opacity-60"
                aria-label="Más acciones"
              >
                <ChevronDown className={`h-4 w-4 transition-transform ${showSubmitMenu ? "rotate-180" : ""}`} />
              </button>
            </div>
          ) : (
            <button
              type="submit"
              disabled={loading}
              onClick={() => {
                setSubmitAction("save");
                setShowSubmitMenu(false);
              }}
              className="w-full rounded-xl bg-blue-600 py-3 px-4 font-medium text-white transition-colors hover:bg-blue-700 tap-target disabled:opacity-60"
            >
              {loading ? "Guardando..." : "Crear"}
            </button>
          )}
          {templateId && showSubmitMenu && (
            <div className="absolute bottom-full left-0 z-10 mb-2 w-full min-w-[220px] rounded-xl border border-blue-700 bg-gradient-to-b from-blue-600 to-blue-700 p-1 shadow-lg">
              <p className="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-blue-100/80">
                Acciones
              </p>
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  setShowSubmitMenu(false);
                  void submitTemplate("submit_review");
                }}
                className="w-full rounded-lg border border-blue-300/30 bg-blue-500/40 px-3 py-2.5 text-left text-sm font-medium text-white transition-colors hover:bg-blue-500/60 disabled:opacity-60"
              >
                Enviar a revisión {" >>"}
              </button>
            </div>
          )}
        </div>
        <Link
          href={
            cancelHref?.trim() ||
            (templateId ? `/checklists/${templateId}` : "/checklists")
          }
          className="rounded-xl border border-zinc-300 py-3 px-4 font-medium text-zinc-700 tap-target"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
