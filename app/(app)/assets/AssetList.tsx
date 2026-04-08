"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

type Asset = {
  id: string;
  name: string;
  assetId: string;
  updatedAt: string;
};

export function AssetList() {
  const [items, setItems] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    fetch(`/api/assets?${params}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setItems(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [search]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <input
          type="search"
          placeholder="Buscar maquinas…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 placeholder:text-zinc-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 md:max-w-md"
        />
      </div>
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 rounded-xl bg-zinc-100 animate-pulse"
              aria-hidden
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center">
          <p className="text-zinc-500">Aún no hay maquinas.</p>
          <Link
            href="/assets/new"
            className="mt-3 inline-block text-primary-600 font-medium"
          >
            Añadir uno
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((asset) => (
            <li key={asset.id}>
              <Link
                href={`/assets/${asset.id}`}
                className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-primary-200 hover:bg-primary-50/50 tap-target"
              >
                <div>
                  <p className="text-base font-medium text-zinc-900">
                    {asset.name}
                  </p>
                  <p className="text-sm text-zinc-500">{asset.assetId}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-zinc-400 shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
