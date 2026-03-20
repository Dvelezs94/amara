"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

type Template = { id: string; name: string; description: string | null };

export function ChecklistList() {
  const [items, setItems] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [size, setSize] = useState<"sm" | "md" | "lg">("md");
  const SIZE_KEY = "checklist-list-size-v1";

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SIZE_KEY);
      if (saved === "sm" || saved === "md" || saved === "lg") setSize(saved);
    } catch {
      setSize("md");
    }
  }, []);

  function changeSize(next: "sm" | "md" | "lg") {
    setSize(next);
    localStorage.setItem(SIZE_KEY, next);
  }

  useEffect(() => {
    fetch("/api/checklist-templates")
      .then((res) => res.json())
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="flex justify-end">
          <div className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-1">
            {(["sm", "md", "lg"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => changeSize(v)}
                className={`rounded px-2 py-1 text-[11px] font-semibold ${
                  size === v ? "bg-primary-600 text-white" : "text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                {v.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={`rounded-xl bg-zinc-100 animate-pulse ${
              size === "lg" ? "h-24" : size === "sm" ? "h-12" : "h-16"
            }`}
            aria-hidden
          />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center">
        <p className="text-zinc-500">Aún no hay plantillas de checklist.</p>
        <p className="text-sm text-zinc-400 mt-1">
          Crea plantillas con pasos y campos (texto, número, fecha, lista, casilla) y asígnalas a órdenes de trabajo.
        </p>
        <Link href="/checklists/new" className="mt-3 inline-block text-primary-600 font-medium">
          Crear una
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <div className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-1">
          {(["sm", "md", "lg"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => changeSize(v)}
              className={`rounded px-2 py-1 text-[11px] font-semibold ${
                size === v ? "bg-primary-600 text-white" : "text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              {v.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <ul className="space-y-2">
        {items.map((t) => (
          <li key={t.id}>
            <Link
              href={`/checklists/${t.id}`}
              className={`flex items-center justify-between rounded-xl border border-zinc-200 bg-white hover:border-primary-200 hover:bg-primary-50/50 transition tap-target ${
                size === "lg" ? "p-5" : size === "sm" ? "p-2.5" : "p-4"
              }`}
            >
              <div>
                <p className={`font-medium text-zinc-900 ${size === "sm" ? "text-sm" : "text-base"}`}>{t.name}</p>
                {t.description && (
                  <p
                    className={`mt-0.5 text-zinc-500 ${
                      size === "sm" ? "text-xs line-clamp-1" : "text-sm line-clamp-1"
                    }`}
                  >
                    {t.description}
                  </p>
                )}
              </div>
              <ChevronRight className="h-5 w-5 text-zinc-400 shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
