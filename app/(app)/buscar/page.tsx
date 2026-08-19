"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { SetPageHeader } from "@/components/SetPageHeader";
import type { GlobalSearchGroup } from "@/lib/global-search";
import {
  isSearchQueryReady,
  normalizeSearchQuery,
} from "@/lib/global-search";

type SearchResponse = {
  query?: string;
  groups?: GlobalSearchGroup[];
};

export default function BuscarPage() {
  const searchParams = useSearchParams();
  const q = normalizeSearchQuery(searchParams.get("q") ?? "");
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<GlobalSearchGroup[]>([]);

  useEffect(() => {
    if (!isSearchQueryReady(q)) {
      setGroups([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(q)}&limit=20`)
      .then((res) => res.json())
      .then((data: SearchResponse) => {
        if (!cancelled) {
          setGroups(Array.isArray(data.groups) ? data.groups : []);
        }
      })
      .catch(() => {
        if (!cancelled) setGroups([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [q]);

  const total = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <SetPageHeader
        title="Búsqueda"
        subtitle={q ? `Resultados para «${q}»` : "Escribe en el buscador del encabezado"}
      />

      {!isSearchQueryReady(q) ? (
        <div className="rounded-xl border border-dashed border-zinc-200 bg-white p-8 text-center">
          <Search className="mx-auto mb-3 h-10 w-10 text-zinc-300" aria-hidden />
          <p className="text-sm text-zinc-600">
            Busca tareas, eventos de calendario, máquinas, checklists, personas y
            archivos.
          </p>
        </div>
      ) : loading ? (
        <p className="text-sm text-zinc-500">Buscando…</p>
      ) : total === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center">
          <p className="text-sm text-zinc-600">
            No hay resultados para{" "}
            <span className="font-medium text-zinc-800">{q}</span>.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <section
              key={group.kind}
              className="overflow-hidden rounded-xl border border-zinc-200 bg-white"
            >
              <h2 className="border-b border-zinc-100 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                {group.label}
              </h2>
              <ul className="divide-y divide-zinc-100">
                {group.items.map((item) => (
                  <li key={`${item.kind}-${item.id}`}>
                    <Link
                      href={item.href}
                      className="block px-4 py-3 hover:bg-zinc-50"
                    >
                      <p className="font-medium text-zinc-900">{item.title}</p>
                      {item.subtitle ? (
                        <p className="mt-0.5 truncate text-xs text-zinc-500">
                          {item.subtitle}
                        </p>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
