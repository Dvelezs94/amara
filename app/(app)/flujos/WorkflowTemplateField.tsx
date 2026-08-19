"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  filterWorkflowTemplateVariables,
  insertWorkflowTemplateVariable,
  matchWorkflowTemplateToken,
} from "@/lib/workflow-template";

const FIELD =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500";

export function WorkflowTemplateField({
  id,
  value,
  onChange,
  multiline,
  rows = 3,
}: {
  id?: string;
  value: string;
  onChange: (next: string) => void;
  multiline?: boolean;
  rows?: number;
}) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const listId = `${fieldId}-vars`;
  const ref = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);
  const [cursor, setCursor] = useState(value.length);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const token = matchWorkflowTemplateToken(value, cursor);
  const suggestions = useMemo(
    () => (token ? filterWorkflowTemplateVariables(token.query) : []),
    [token]
  );
  const showMenu = open && token !== null;

  useEffect(() => {
    setActive(0);
  }, [token?.query, token?.start]);

  useEffect(() => {
    function onDocPointer(e: MouseEvent) {
      const el = ref.current;
      if (!el) return;
      const root = el.closest("[data-template-field]");
      if (root && !root.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocPointer);
    return () => document.removeEventListener("mousedown", onDocPointer);
  }, []);

  function syncCursor(el: HTMLTextAreaElement | HTMLInputElement) {
    setCursor(el.selectionStart ?? el.value.length);
  }

  function apply(key: string) {
    const next = insertWorkflowTemplateVariable(value, cursor, key);
    onChange(next.text);
    setCursor(next.cursor);
    setOpen(false);
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(next.cursor, next.cursor);
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) {
    if (!showMenu) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (suggestions.length === 0 ? 0 : (i + 1) % suggestions.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) =>
        suggestions.length === 0
          ? 0
          : (i - 1 + suggestions.length) % suggestions.length
      );
    } else if (e.key === "Enter" || e.key === "Tab") {
      const selected = suggestions[active] ?? suggestions[0];
      if (selected) {
        e.preventDefault();
        apply(selected.key);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  const shared = {
    id: fieldId,
    value,
    autoComplete: "off" as const,
    role: "combobox" as const,
    "aria-expanded": showMenu,
    "aria-autocomplete": "list" as const,
    "aria-controls": listId,
    className: FIELD,
    onKeyDown,
    onClick: (e: React.MouseEvent<HTMLTextAreaElement | HTMLInputElement>) =>
      syncCursor(e.currentTarget),
    onSelect: (e: React.SyntheticEvent<HTMLTextAreaElement | HTMLInputElement>) =>
      syncCursor(e.currentTarget),
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
      onChange(e.target.value);
      syncCursor(e.currentTarget);
      setOpen(true);
    },
  };

  return (
    <div className="relative" data-template-field>
      {multiline ? (
        <textarea
          {...shared}
          ref={(el) => {
            ref.current = el;
          }}
          rows={rows}
        />
      ) : (
        <input
          {...shared}
          ref={(el) => {
            ref.current = el;
          }}
          type="text"
        />
      )}
      {showMenu ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg"
        >
          {suggestions.length === 0 ? (
            <li className="px-3 py-2 text-xs text-zinc-500">
              Sin coincidencias
            </li>
          ) : (
            suggestions.map((item, index) => (
              <li key={item.key} role="option" aria-selected={index === active}>
                <button
                  type="button"
                  className={`flex min-h-[44px] w-full items-baseline justify-between gap-3 px-3 py-1.5 text-left sm:min-h-0 ${
                    index === active ? "bg-primary-50" : "hover:bg-zinc-50"
                  }`}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => apply(item.key)}
                >
                  <span className="font-mono text-sm text-zinc-900">
                    {`{{${item.key}}}`}
                  </span>
                  <span className="truncate text-xs text-zinc-500">
                    {item.label}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
