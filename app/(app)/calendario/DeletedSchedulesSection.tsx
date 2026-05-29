"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const PAGE_SIZE = 5;

type DeletedRow = { id: string; name: string; deletedAt: string | null };

export function DeletedSchedulesSection({
  initial,
  initialHasMore = false,
}: {
  initial: DeletedRow[];
  initialHasMore?: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    setItems(initial);
    setHasMore(initialHasMore);
  }, [initial, initialHasMore]);

  if (items.length === 0) return null;

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(
        `/api/maintenance-schedules/deleted?limit=${PAGE_SIZE}&offset=${items.length}`
      );
      const data = await res.json().catch(() => ({}));
      const next: DeletedRow[] = Array.isArray(data?.items) ? data.items : [];
      setItems((prev) => [...prev, ...next]);
      setHasMore(Boolean(data?.hasMore));
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-900">
        Programaciones eliminadas del calendario
      </h2>
      <p className="mt-1 text-xs text-zinc-500">
        Siguen guardadas; puedes restaurarlas para que vuelvan a mostrarse y repetirse como antes.
      </p>
      <ul className="mt-3 divide-y divide-zinc-100">
        {items.map((row) => (
          <li
            key={row.id}
            className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-zinc-900">{row.name}</p>
              {row.deletedAt ? (
                <p className="text-[11px] text-zinc-400">
                  Eliminada{" "}
                  {new Date(row.deletedAt).toLocaleString("es-MX", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              disabled={restoringId === row.id}
              onClick={async () => {
                setRestoringId(row.id);
                try {
                  const res = await fetch(`/api/maintenance-schedules/${row.id}/restore`, {
                    method: "POST",
                  });
                  if (res.ok) {
                    setItems((prev) => prev.filter((x) => x.id !== row.id));
                    router.refresh();
                  }
                } finally {
                  setRestoringId(null);
                }
              }}
              className="shrink-0 rounded-lg border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-800 hover:bg-primary-100 disabled:opacity-50"
            >
              {restoringId === row.id ? "Restaurando…" : "Restaurar"}
            </button>
          </li>
        ))}
      </ul>
      {hasMore ? (
        <button
          type="button"
          disabled={loadingMore}
          onClick={() => void loadMore()}
          className="mt-3 w-full rounded-lg border border-zinc-200 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
        >
          {loadingMore ? "Cargando…" : "Cargar más"}
        </button>
      ) : null}
    </section>
  );
}
