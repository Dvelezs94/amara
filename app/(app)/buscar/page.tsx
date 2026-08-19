"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  Factory,
  ListTodo,
  Search,
  User,
} from "lucide-react";
import { useEffect, useState } from "react";
import { SetPageHeader } from "@/components/SetPageHeader";
import type { GlobalSearchGroup, GlobalSearchKind } from "@/lib/global-search";
import {
  globalSearchResultCountLabel,
  isSearchQueryReady,
  normalizeSearchQuery,
} from "@/lib/global-search";

type SearchResponse = {
  query?: string;
  groups?: GlobalSearchGroup[];
};

function searchKindHeaderClass(kind: GlobalSearchKind): string {
  switch (kind) {
    case "work_order":
      return "border-primary-100 bg-primary-50";
    case "schedule":
      return "border-accent-100 bg-accent-50";
    case "asset":
      return "border-sky-100 bg-sky-50";
    case "checklist":
      return "border-emerald-100 bg-emerald-50";
    case "person":
      return "border-violet-100 bg-violet-50";
    case "knowledge":
      return "border-amber-100 bg-amber-50";
  }
}

function searchKindIconClass(kind: GlobalSearchKind): string {
  switch (kind) {
    case "work_order":
      return "bg-primary-600 text-white";
    case "schedule":
      return "bg-accent-500 text-white";
    case "asset":
      return "bg-sky-600 text-white";
    case "checklist":
      return "bg-emerald-600 text-white";
    case "person":
      return "bg-violet-600 text-white";
    case "knowledge":
      return "bg-amber-600 text-white";
  }
}

function searchKindCountClass(kind: GlobalSearchKind): string {
  switch (kind) {
    case "work_order":
      return "bg-white/90 text-primary-800";
    case "schedule":
      return "bg-white/90 text-accent-800";
    case "asset":
      return "bg-white/90 text-sky-800";
    case "checklist":
      return "bg-white/90 text-emerald-800";
    case "person":
      return "bg-white/90 text-violet-800";
    case "knowledge":
      return "bg-white/90 text-amber-900";
  }
}

function SearchKindIcon({ kind }: { kind: GlobalSearchKind }) {
  const className = "h-4 w-4 text-white";
  switch (kind) {
    case "work_order":
      return <ListTodo className={className} />;
    case "schedule":
      return <CalendarDays className={className} />;
    case "asset":
      return <Factory className={className} />;
    case "checklist":
      return <ClipboardCheck className={className} />;
    case "person":
      return <User className={className} />;
    case "knowledge":
      return <BookOpen className={className} />;
  }
}

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
                className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm"
              >
                <div
                  className={`flex items-center gap-3 border-b px-4 py-3 ${searchKindHeaderClass(group.kind)}`}
                >
                  <span
                    className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg shadow-sm ${searchKindIconClass(group.kind)}`}
                    aria-hidden
                  >
                    <SearchKindIcon kind={group.kind} />
                  </span>
                  <h2 className="text-sm font-semibold tracking-tight text-zinc-900">
                    {group.label}
                  </h2>
                  <span
                    className={`ml-auto rounded-full px-2.5 py-0.5 text-[11px] font-medium tabular-nums ${searchKindCountClass(group.kind)}`}
                  >
                    {globalSearchResultCountLabel(group.items.length)}
                  </span>
                </div>
                <ul className="divide-y divide-zinc-100">
                  {group.items.map((item) => (
                    <li key={`${item.kind}-${item.id}`}>
                      <Link
                        href={item.href}
                        className="block px-4 py-3 transition-colors hover:bg-zinc-50"
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
