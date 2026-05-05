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
  type: "step" | "custom_field" | "text_block";
  label: string;
  fieldType?: string;
  options?: string[];
};

export function ChecklistTemplateForm({
  templateId,
  initial,
  initialRevisionName,
  draftRevisionId,
}: {
  templateId?: string;
  initial?: {
    name: string;
    description?: string | null;
    items?: { type: string; label: string; fieldType?: string | null; options?: string[] | null | unknown }[];
  };
  initialRevisionName?: string;
  draftRevisionId?: string;
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
  const [items, setItems] = useState<Item[]>(
    (initial?.items ?? []).map((i, idx) => ({
      id: makeItemId(),
      type:
        i.type === "custom_field" || i.type === "text_block" || i.type === "step"
          ? i.type
          : "custom_field",
      label: i.label,
      fieldType:
        i.type === "text_block"
          ? i.fieldType ?? "paragraph"
          : i.fieldType ?? "text",
      options: Array.isArray(i.options) ? (i.options as string[]).map((o) => String(o)) : [],
    }))
  );
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  function addStep() {
    setItems((prev) => [
      ...prev,
      { id: makeItemId(), type: "text_block", label: "Nuevo texto", fieldType: "paragraph" },
    ]);
  }

  function addCustomField() {
    setItems((prev) => [...prev, { id: makeItemId(), type: "custom_field", label: "Nuevo campo", fieldType: "number" }]);
  }

  function moveItem(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;
    setItems((prev) => {
      const next = [...prev];
      const [removed] = next.splice(fromIndex, 1);
      const insertIndex = fromIndex < toIndex ? toIndex - 1 : toIndex;
      next.splice(insertIndex, 0, removed);
      return next;
    });
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
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function addDropdownOption(index: number) {
    setItems((prev) => {
      const next = [...prev];
      const it = next[index];
      if (it.type !== "custom_field") return prev;
      const opts = it.options ?? [];
      next[index] = { ...it, options: [...opts, "Opción"] };
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
            revisionName: revisionName.trim() || "Sin nombre",
            name: nameTrim,
            description: description.trim() || null,
            items: items.map((it) =>
              it.type === "custom_field"
                ? {
                    type: "custom_field",
                    label: it.label.trim() || "Campo",
                    fieldType: it.fieldType ?? "text",
                    options: it.fieldType === "dropdown" ? it.options : undefined,
                  }
                : it.type === "text_block"
                  ? {
                      type: "text_block",
                      label: it.label.trim() || "Nuevo texto",
                      fieldType:
                        it.fieldType === "title" ||
                        it.fieldType === "subtitle" ||
                        it.fieldType === "paragraph"
                          ? it.fieldType
                          : "paragraph",
                    }
                  : { type: "step", label: it.label.trim() || "Paso" }
            ),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error ?? "No se pudo crear la revisión");
          window.scrollTo({ top: 0, behavior: "smooth" });
          setLoading(false);
          return;
        }
        if (data.status === "proposed") {
          window.scrollTo({ top: 0, behavior: "smooth" });
          router.push(`/checklists/${templateId}?mode=view&notice=revision_submitted`);
        } else if (data.status === "draft") {
          const revisionId = String(data.revisionId ?? draftRevisionId ?? "").trim();
          const params = new URLSearchParams({ mode: "edit", notice: "draft_saved" });
          if (revisionId) params.set("draftRevisionId", revisionId);
          router.push(`/checklists/${templateId}?${params.toString()}`);
        } else {
          router.push(`/checklists/${templateId}`);
        }
      } else {
        const res = await fetch("/api/checklist-templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: nameTrim,
            description: description.trim() || null,
            items: items.map((it) =>
              it.type === "custom_field"
                ? {
                    type: "custom_field",
                    label: it.label.trim() || "Campo",
                    fieldType: it.fieldType ?? "text",
                    options: it.fieldType === "dropdown" ? it.options : undefined,
                  }
                : it.type === "text_block"
                  ? {
                      type: "text_block",
                      label: it.label.trim() || "Nuevo texto",
                      fieldType:
                        it.fieldType === "title" ||
                        it.fieldType === "subtitle" ||
                        it.fieldType === "paragraph"
                          ? it.fieldType
                          : "paragraph",
                    }
                  : { type: "step", label: it.label.trim() || "Paso" }
            ),
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
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-medium text-zinc-700">Elementos (pasos y campos)</h2>
          <div className="flex items-center gap-2">
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
          {items.map((item, index) => (
            <li
              key={item.id}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={`flex gap-2 items-start rounded-lg border-2 bg-white p-3 transition-colors ${
                draggedIndex === index
                  ? "opacity-50 border-primary-300 cursor-grabbing"
                  : dropIndex === index && draggedIndex !== index
                    ? "border-primary-400 bg-primary-50/50"
                    : "border-zinc-200"
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
                  placeholder={item.type === "step" ? "Etiqueta del paso" : "Etiqueta del campo"}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
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
          ))}
        </ul>
        {items.length > 5 && (
          <div className="mt-3 flex justify-end">
            <div className="flex items-center gap-2">
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
          href={templateId ? `/checklists/${templateId}` : "/checklists"}
          className="rounded-xl border border-zinc-300 py-3 px-4 font-medium text-zinc-700 tap-target"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
