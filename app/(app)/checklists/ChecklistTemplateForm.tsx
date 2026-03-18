"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2, GripVertical } from "lucide-react";

const FIELD_TYPES = [
  { value: "text", label: "Texto" },
  { value: "number", label: "Número" },
  { value: "date", label: "Fecha" },
  { value: "dropdown", label: "Lista desplegable" },
  { value: "checkbox", label: "Casilla" },
  { value: "photo", label: "Foto" },
] as const;

type Item = {
  type: "step" | "custom_field";
  label: string;
  fieldType?: string;
  options?: string[];
};

export function ChecklistTemplateForm({
  templateId,
  initial,
}: {
  templateId?: string;
  initial?: {
    name: string;
    description?: string | null;
    items?: { type: string; label: string; fieldType?: string | null; options?: string[] | null | unknown }[];
  };
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [items, setItems] = useState<Item[]>(
    (initial?.items ?? []).map((i) => ({
      type: i.type as "step" | "custom_field",
      label: i.label,
      fieldType: i.fieldType ?? "text",
      options: Array.isArray(i.options) ? (i.options as string[]).map((o) => String(o)) : [],
    }))
  );

  function addStep() {
    setItems((prev) => [...prev, { type: "step", label: "Nuevo paso" }]);
  }

  function addCustomField() {
    setItems((prev) => [...prev, { type: "custom_field", label: "Nuevo campo", fieldType: "text" }]);
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

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const nameTrim = name.trim();
    if (!nameTrim) {
      setError("El nombre es obligatorio");
      setLoading(false);
      return;
    }
    try {
      if (templateId) {
        await fetch(`/api/checklist-templates/${templateId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: nameTrim, description: description.trim() || null }),
        });
        await fetch(`/api/checklist-templates/${templateId}/items`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: items.map((it) =>
              it.type === "custom_field"
                ? {
                    type: "custom_field",
                    label: it.label.trim() || "Campo",
                    fieldType: it.fieldType ?? "text",
                    options: it.fieldType === "dropdown" ? it.options : undefined,
                  }
                : { type: "step", label: it.label.trim() || "Paso" }
            ),
          }),
        });
        router.push("/checklists");
      } else {
        const res = await fetch("/api/checklist-templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: nameTrim, description: description.trim() || null }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error ?? "Error al crear");
          setLoading(false);
          return;
        }
        const id = data.id;
        await fetch(`/api/checklist-templates/${id}/items`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: items.map((it) =>
              it.type === "custom_field"
                ? {
                    type: "custom_field",
                    label: it.label.trim() || "Campo",
                    fieldType: it.fieldType ?? "text",
                    options: it.fieldType === "dropdown" ? it.options : undefined,
                  }
                : { type: "step", label: it.label.trim() || "Paso" }
            ),
          }),
        });
        router.push(`/checklists/${id}`);
      }
      router.refresh();
    } catch {
      setError("Algo salió mal");
    }
    setLoading(false);
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

      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-medium text-zinc-700">Elementos (pasos y campos)</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={addStep}
              className="text-sm text-primary-600 font-medium flex items-center gap-1"
            >
              <Plus className="h-4 w-4" /> Paso
            </button>
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
              key={index}
              className="flex gap-2 items-start rounded-lg border border-zinc-200 bg-white p-3"
            >
              <GripVertical className="h-5 w-5 text-zinc-400 shrink-0 mt-1" aria-hidden />
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
                              className="flex-1 rounded border border-zinc-300 px-2 py-1 text-sm"
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
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 rounded-xl bg-primary-600 text-white py-3 px-4 font-medium tap-target disabled:opacity-60"
        >
          {loading ? "Guardando…" : templateId ? "Guardar" : "Crear"}
        </button>
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
