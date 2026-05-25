"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

const STORAGE_KEY = "msa-checklist-section-expanded";

export const checklistSectionShellClass =
  "overflow-hidden rounded-xl border border-zinc-300 bg-white shadow-sm";
export const checklistSectionHeaderClass =
  "flex w-full items-center justify-between gap-2 border-b border-zinc-200 bg-zinc-100 px-4 py-3 text-left transition hover:bg-zinc-200/60";
export const checklistSectionTitleClass = "text-sm font-bold tracking-tight text-zinc-900";
export const checklistSectionBodyClass = "";

function readExpanded(storageId: string | null, defaultExpanded: boolean): boolean {
  if (!storageId || typeof window === "undefined") return defaultExpanded;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultExpanded;
    const map = JSON.parse(raw) as Record<string, boolean>;
    if (typeof map[storageId] === "boolean") return map[storageId];
  } catch {
    /* ignore */
  }
  return defaultExpanded;
}

function writeExpanded(storageId: string | null, expanded: boolean) {
  if (!storageId || typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    map[storageId] = expanded;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function ChecklistSectionShell({
  sectionId,
  title,
  children,
  className,
  collapseContextKey,
  defaultExpanded = true,
}: {
  sectionId: string;
  title: string;
  children: ReactNode;
  className?: string;
  /** When set, collapse state is remembered per section (e.g. work order id). */
  collapseContextKey?: string;
  defaultExpanded?: boolean;
}) {
  const storageId = collapseContextKey ? `${collapseContextKey}:${sectionId}` : null;
  const [expanded, setExpanded] = useState(() =>
    readExpanded(storageId, defaultExpanded)
  );

  useEffect(() => {
    setExpanded(readExpanded(storageId, defaultExpanded));
  }, [storageId, defaultExpanded]);

  const toggle = useCallback(() => {
    setExpanded((prev) => {
      const next = !prev;
      writeExpanded(storageId, next);
      return next;
    });
  }, [storageId]);

  return (
    <div className={[checklistSectionShellClass, className].filter(Boolean).join(" ")}>
      <button
        type="button"
        onClick={toggle}
        className={checklistSectionHeaderClass}
        aria-expanded={expanded}
        aria-controls={`checklist-section-body-${sectionId}`}
      >
        <span className={checklistSectionTitleClass}>{title}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${expanded ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {expanded ? (
        <div id={`checklist-section-body-${sectionId}`} className={checklistSectionBodyClass}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function ChecklistSubsectionHeading({ title }: { title: string }) {
  return (
    <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-2.5">
      <p className="text-xs font-bold uppercase tracking-wide text-zinc-700">{title}</p>
    </div>
  );
}
