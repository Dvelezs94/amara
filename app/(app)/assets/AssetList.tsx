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
  const [size, setSize] = useState<"sm" | "md" | "lg">("md");
  const SIZE_KEY = "assets-list-size-v1";

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
      {loading ? (
        <div className="space-y-2">
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
                className={`flex items-center justify-between rounded-xl border border-zinc-200 bg-white hover:border-primary-200 hover:bg-primary-50/50 transition tap-target ${
                  size === "lg" ? "p-5" : size === "sm" ? "p-2.5" : "p-4"
                }`}
              >
                <div>
                  <p className={`font-medium text-zinc-900 ${size === "sm" ? "text-sm" : "text-base"}`}>
                    {asset.name}
                  </p>
                  <p className={`${size === "sm" ? "text-xs" : "text-sm"} text-zinc-500`}>{asset.assetId}</p>
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
