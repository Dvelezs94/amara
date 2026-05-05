"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

type Template = { id: string; name: string; description: string | null };

export function ChecklistList({ canCreate = true }: { canCreate?: boolean }) {
  const [items, setItems] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

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
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-16 rounded-xl bg-zinc-100 animate-pulse"
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
        {canCreate ? (
          <Link href="/checklists/new" className="mt-3 inline-block text-primary-600 font-medium">
            Crear una
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {items.map((t) => (
          <li key={t.id}>
            <Link
              href={`/checklists/${t.id}`}
              className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 hover:border-primary-200 hover:bg-primary-50/50 transition tap-target"
            >
              <div>
                <p className="font-medium text-zinc-900">{t.name}</p>
                {t.description && (
                  <p className="mt-0.5 text-sm text-zinc-500 line-clamp-1">
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
