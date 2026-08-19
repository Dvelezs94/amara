"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { GlobalSearchGroup, GlobalSearchHit } from "@/lib/global-search";
import {
  GLOBAL_SEARCH_MIN_QUERY_LENGTH,
  isSearchQueryReady,
  normalizeSearchQuery,
} from "@/lib/global-search";

type SearchResponse = {
  query?: string;
  groups?: GlobalSearchGroup[];
};

export function GlobalSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<GlobalSearchGroup[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    setQuery(searchParams.get("q") ?? "");
  }, [searchParams]);

  const q = normalizeSearchQuery(query);
  const ready = isSearchQueryReady(q);
  const flatHits = useMemo(
    () => groups.flatMap((g) => g.items),
    [groups]
  );

  useEffect(() => {
    if (!ready) {
      setGroups([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      fetch(`/api/search?q=${encodeURIComponent(q)}`, {
        signal: controller.signal,
      })
        .then((res) => res.json())
        .then((data: SearchResponse) => {
          setGroups(Array.isArray(data.groups) ? data.groups : []);
          setActiveIndex(-1);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setGroups([]);
        })
        .finally(() => setLoading(false));
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [q, ready]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [open]);

  function goToResultsPage() {
    const next = normalizeSearchQuery(query);
    setOpen(false);
    if (!isSearchQueryReady(next)) {
      router.push("/buscar");
      return;
    }
    router.push(`/buscar?q=${encodeURIComponent(next)}`);
  }

  function goToHit(hit: GlobalSearchHit) {
    setOpen(false);
    router.push(hit.href);
  }

  const showMenu = open && ready;

  return (
    <div className="relative hidden min-w-[260px] md:block" ref={rootRef}>
      <div className="flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
        <Search className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              return;
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActiveIndex((i) =>
                flatHits.length === 0 ? -1 : Math.min(flatHits.length - 1, i + 1)
              );
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIndex((i) => Math.max(-1, i - 1));
              return;
            }
            if (e.key === "Enter") {
              e.preventDefault();
              const hit = activeIndex >= 0 ? flatHits[activeIndex] : null;
              if (hit) goToHit(hit);
              else goToResultsPage();
            }
          }}
          aria-label="Buscar"
          aria-expanded={showMenu}
          aria-controls={listId}
          aria-autocomplete="list"
          className="w-full border-0 bg-transparent p-0 text-xs text-zinc-800 placeholder:text-neutral-400 focus:outline-none"
          placeholder="Buscar tareas, máquinas, checklists..."
        />
      </div>
      {showMenu ? (
        <div
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 z-40 mt-1 max-h-96 overflow-y-auto rounded-md border border-zinc-200 bg-white py-1 shadow-lg"
        >
          {loading && groups.length === 0 ? (
            <p className="px-3 py-2 text-xs text-neutral-400">Buscando…</p>
          ) : groups.length === 0 ? (
            <p className="px-3 py-2 text-xs text-neutral-400">
              Sin resultados. Pulsa Enter para ver la búsqueda.
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.kind}>
                <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                  {group.label}
                </p>
                {group.items.map((item) => {
                  const index = flatHits.indexOf(item);
                  const active = index === activeIndex;
                  return (
                    <Link
                      key={`${item.kind}-${item.id}`}
                      href={item.href}
                      role="option"
                      aria-selected={active}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => setOpen(false)}
                      className={`block px-3 py-1.5 text-xs ${
                        active ? "bg-primary-50 text-zinc-900" : "text-zinc-700"
                      }`}
                    >
                      <span className="block truncate font-medium">{item.title}</span>
                      {item.subtitle ? (
                        <span className="block truncate text-[11px] text-zinc-500">
                          {item.subtitle}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            ))
          )}
          <button
            type="button"
            onClick={goToResultsPage}
            className="mt-1 w-full border-t border-zinc-100 px-3 py-2 text-left text-xs font-medium text-[#F14C03] hover:bg-zinc-50"
          >
            Ver todos los resultados
          </button>
        </div>
      ) : ready ? null : open && query.trim().length > 0 ? (
        <div className="absolute left-0 right-0 z-40 mt-1 rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-neutral-400 shadow-lg">
          Escribe al menos {GLOBAL_SEARCH_MIN_QUERY_LENGTH} caracteres
        </div>
      ) : null}
    </div>
  );
}
