"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { filterUsersByAssigneeQuery } from "@/lib/assignee-search";

/**
 * Selected people as chips + typeahead to add more (calendar, tareas, flujos).
 */
export function AssigneeMultiSelect({
  id,
  users,
  value,
  onChange,
  disabled,
  label = "Responsables",
  emptyHint = "Nadie seleccionado",
}: {
  id?: string;
  users: { id: string; name: string }[];
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  label?: string;
  emptyHint?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const byId = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const selected = value
    .map((uid) => byId.get(uid))
    .filter((u): u is { id: string; name: string } => Boolean(u));
  const suggestions = useMemo(
    () => filterUsersByAssigneeQuery(users, query, value),
    [users, query, value]
  );
  const showMenu = open && query.trim().length > 0 && !disabled;

  useEffect(() => {
    function onDocPointer(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocPointer);
    return () => document.removeEventListener("mousedown", onDocPointer);
  }, []);

  function add(uid: string) {
    if (disabled || value.includes(uid)) return;
    onChange([...value, uid]);
    setQuery("");
    setOpen(false);
  }

  function remove(uid: string) {
    if (disabled) return;
    onChange(value.filter((idValue) => idValue !== uid));
  }

  return (
    <div ref={wrapRef} className="min-h-0 space-y-1.5">
      {label ? (
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
          {label}
        </p>
      ) : null}

      {selected.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {selected.map((u) => (
            <li
              key={u.id}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-primary-100 bg-primary-50 py-0.5 pl-2.5 pr-1 text-xs font-medium text-primary-900"
            >
              <span className="min-w-0 truncate">{u.name}</span>
              <button
                type="button"
                onClick={() => remove(u.id)}
                disabled={disabled}
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-primary-800 hover:bg-primary-100 disabled:opacity-50 tap-target"
                aria-label={`Quitar ${u.name}`}
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[11px] text-zinc-500">{emptyHint}</p>
      )}

      <div className="relative">
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={showMenu}
          aria-autocomplete="list"
          aria-controls={id ? `${id}-suggest` : undefined}
          autoComplete="off"
          disabled={disabled}
          value={query}
          placeholder="Escribe un nombre…"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (query.trim()) setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              const first = suggestions[0];
              if (first) add(first.id);
            }
            if (e.key === "Escape") setOpen(false);
          }}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-60"
        />
        {showMenu ? (
          <ul
            id={id ? `${id}-suggest` : undefined}
            role="listbox"
            className="absolute z-30 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg"
          >
            {suggestions.length === 0 ? (
              <li className="px-3 py-2 text-xs text-zinc-500">
                Sin coincidencias
              </li>
            ) : (
              suggestions.map((u) => (
                <li key={u.id} role="option">
                  <button
                    type="button"
                    className="flex min-h-[44px] w-full items-center px-3 py-1.5 text-left text-sm text-zinc-900 hover:bg-zinc-50 sm:min-h-0"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => add(u.id)}
                  >
                    {u.name}
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
