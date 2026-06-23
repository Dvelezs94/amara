"use client";

import { useState } from "react";
import { ChevronDown, X } from "lucide-react";
import {
  groupAnalyticsFieldsBySection,
  type AnalyticsFieldDescriptor,
  type AnalyticsFieldGroup,
} from "@/lib/analytics-checklist-field-key";

function FieldCheckbox({
  field,
  checked,
  onToggle,
}: {
  field: AnalyticsFieldDescriptor;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-md px-3 py-2 text-sm text-zinc-800 hover:bg-zinc-50">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="mt-0.5 shrink-0 rounded border-zinc-400"
      />
      <span className="min-w-0 break-words">{field.label}</span>
    </label>
  );
}

function SectionGroup({
  group,
  depth,
  selectedFieldKeys,
  onToggleField,
}: {
  group: AnalyticsFieldGroup;
  depth: number;
  selectedFieldKeys: string[];
  onToggleField: (key: string) => void;
}) {
  const hasFields = group.fields.length > 0;
  const hasChildren = group.children.length > 0;
  if (!hasFields && !hasChildren) return null;

  const [expanded, setExpanded] = useState(depth === 0);

  return (
    <div className={depth > 0 ? "border-t border-zinc-100" : ""}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-zinc-50 ${
          depth === 0 ? "bg-primary-50/50" : "bg-zinc-50/80"
        }`}
      >
        <span
          className={`min-w-0 break-words font-semibold ${
            depth === 0
              ? "text-xs uppercase tracking-wide text-primary-800"
              : "text-sm text-zinc-800"
          }`}
        >
          {group.title}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${expanded ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {expanded ? (
        <div className={depth === 0 ? "pb-1" : "pb-1 pl-3"}>
          {group.fields.map((field) => (
            <FieldCheckbox
              key={field.key}
              field={field}
              checked={selectedFieldKeys.includes(field.key)}
              onToggle={() => onToggleField(field.key)}
            />
          ))}
          {group.children.map((child) => (
            <SectionGroup
              key={child.id}
              group={child}
              depth={depth + 1}
              selectedFieldKeys={selectedFieldKeys}
              onToggleField={onToggleField}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function AnalyticsFieldsPicker({
  open,
  fields,
  selectedFieldKeys,
  fieldTypeHint,
  onToggleField,
  onClose,
}: {
  open: boolean;
  fields: AnalyticsFieldDescriptor[];
  selectedFieldKeys: string[];
  fieldTypeHint: string | null;
  onToggleField: (key: string) => void;
  onClose: () => void;
}) {
  const groups = groupAnalyticsFieldsBySection(fields);

  if (!open || fields.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-0 md:items-center md:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="analytics-fields-modal-title"
        className="flex max-h-[min(88dvh,720px)] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border border-zinc-200 border-b-0 bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.12)] md:max-h-[min(85vh,640px)] md:rounded-xl md:border-b md:shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
          <h2 id="analytics-fields-modal-title" className="text-sm font-semibold text-zinc-900">
            Campos del checklist
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-sm border border-zinc-300 p-1 text-zinc-700 hover:bg-zinc-100"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <p className="shrink-0 border-b border-zinc-100 bg-zinc-50 px-4 py-2 text-xs text-zinc-600">
          Marca uno o más campos del mismo tipo para graficarlos juntos. Hay {fields.length} campos en
          esta plantilla.
        </p>
        {fieldTypeHint ? (
          <p className="shrink-0 border-b border-amber-100 bg-amber-50 px-4 py-2 text-xs text-amber-900">
            {fieldTypeHint}
          </p>
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto py-2">
          <div className="divide-y divide-zinc-200">
            {groups.map((group) => (
              <SectionGroup
                key={group.id}
                group={group}
                depth={0}
                selectedFieldKeys={selectedFieldKeys}
                onToggleField={onToggleField}
              />
            ))}
          </div>
        </div>
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-zinc-200 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pb-3">
          <p className="text-xs text-zinc-500">
            {selectedFieldKeys.length === 0
              ? "Sin campos seleccionados"
              : `${selectedFieldKeys.length} campo${selectedFieldKeys.length === 1 ? "" : "s"} seleccionado${selectedFieldKeys.length === 1 ? "" : "s"}`}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}
