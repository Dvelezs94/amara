"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FolderPlus, Pencil, Trash2 } from "lucide-react";
import { sortAssetGroups } from "@/lib/asset-group-helpers";
import { useSetPageHeader } from "@/components/PageHeaderContext";
import { AssetPhotoThumb } from "./AssetImageField";

type Group = {
  id: string;
  name: string;
  sortOrder: number;
};

type Asset = {
  id: string;
  name: string;
  assetId: string;
  groupId: string | null;
  imageUrl?: string | null;
  updatedAt: string;
};

type NavId = string | "all";

export function AssetList() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [items, setItems] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedNavId, setSelectedNavId] = useState<NavId>("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [editGroup, setEditGroup] = useState<{ id: string; name: string } | null>(
    null
  );

  useSetPageHeader({
    title: "Máquinas",
    filters: (
      <input
        type="search"
        placeholder="Buscar máquinas…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder:text-zinc-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 md:max-w-md"
      />
    ),
    actions: (
      <Link
        href="/assets/new"
        className="rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white tap-target hover:bg-primary-700"
      >
        Añadir máquina
      </Link>
    ),
  });

  const reload = useCallback(async (q?: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    const [gr, ar] = await Promise.all([
      fetch("/api/asset-groups"),
      fetch(`/api/assets?${params}`),
    ]);
    const ga = await gr.json().catch(() => []);
    const aa = await ar.json().catch(() => []);
    setGroups(Array.isArray(ga) ? ga : []);
    setItems(Array.isArray(aa) ? aa : []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    reload(search)
      .catch(() => {
        if (!cancelled) {
          setGroups([]);
          setItems([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reload, search]);

  const sortedGroups = useMemo(() => sortAssetGroups(groups), [groups]);

  const navItems = useMemo(() => {
    return [
      { id: "all" as const, label: "Todas", count: items.length },
      ...sortedGroups.map((g) => ({
        id: g.id as NavId,
        label: g.name,
        count: items.filter((a) => a.groupId === g.id).length,
      })),
    ];
  }, [sortedGroups, items]);

  const scopedItems = useMemo(() => {
    if (selectedNavId === "all") return items;
    return items.filter((a) => a.groupId === selectedNavId);
  }, [items, selectedNavId]);

  const activeTitle =
    selectedNavId === "all"
      ? "Todas las máquinas"
      : groups.find((g) => g.id === selectedNavId)?.name ?? "Área";

  async function createGroup() {
    const name = newGroupName.trim();
    if (!name) return;
    const res = await fetch("/api/asset-groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      setNewGroupName("");
      setCreateDialogOpen(false);
      await reload(search);
    }
  }

  async function deleteGroup(id: string) {
    if (
      !window.confirm(
        "¿Eliminar esta área? Las máquinas pasarán a «Sin área»."
      )
    ) {
      return;
    }
    const res = await fetch(`/api/asset-groups/${id}`, { method: "DELETE" });
    if (res.ok) {
      if (selectedNavId === id) setSelectedNavId("all");
      await reload(search);
    }
  }

  async function saveEditGroup() {
    if (!editGroup) return;
    const name = editGroup.name.trim();
    if (!name) return;
    const original = groups.find((g) => g.id === editGroup.id);
    if (!original || name === original.name) {
      setEditGroup(null);
      return;
    }
    const res = await fetch(`/api/asset-groups/${editGroup.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      setEditGroup(null);
      await reload(search);
    }
  }

  async function moveAsset(assetId: string, groupId: string | null) {
    const res = await fetch(`/api/assets/${assetId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId }),
    });
    if (res.ok) await reload(search);
  }

  const createModal = createDialogOpen && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md space-y-3 rounded-xl bg-white p-4 text-left shadow-lg">
        <h2 className="font-semibold text-zinc-900">Nueva área</h2>
        <label className="block text-sm text-zinc-600">
          Nombre
          <input
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-zinc-900"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void createGroup();
              }
            }}
            autoFocus
          />
        </label>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="rounded-lg px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100"
            onClick={() => {
              setCreateDialogOpen(false);
              setNewGroupName("");
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white"
            onClick={() => void createGroup()}
          >
            Crear
          </button>
        </div>
      </div>
    </div>
  );

  const editModal = editGroup && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md space-y-3 rounded-xl bg-white p-4 text-left shadow-lg">
        <h2 className="font-semibold text-zinc-900">Editar área</h2>
        <label className="block text-sm text-zinc-600">
          Nombre
          <input
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-zinc-900"
            value={editGroup.name}
            onChange={(e) =>
              setEditGroup((prev) =>
                prev ? { ...prev, name: e.target.value } : null
              )
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void saveEditGroup();
              }
            }}
            autoFocus
          />
        </label>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="rounded-lg px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100"
            onClick={() => setEditGroup(null)}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white"
            onClick={() => void saveEditGroup()}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );

  const activeGroup =
    selectedNavId !== "all"
      ? groups.find((g) => g.id === selectedNavId)
      : null;

  return (
    <div className="space-y-3">
      {createModal}
      {editModal}
      {loading ? (
        <div className="h-64 animate-pulse rounded-xl bg-zinc-100" aria-hidden />
      ) : (
        <div className="flex min-h-[28rem] flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white md:flex-row">
          <aside className="flex w-full shrink-0 flex-col border-b border-zinc-200 bg-zinc-50 md:w-56 md:border-b-0 md:border-r">
            <div className="flex items-center justify-between gap-2 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Áreas
              </p>
            </div>
            <nav className="flex flex-1 gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:overflow-x-visible">
              {navItems.map((n) => (
                <button
                  key={String(n.id)}
                  type="button"
                  onClick={() => setSelectedNavId(n.id)}
                  className={`tap-target flex shrink-0 items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm md:w-full ${
                    selectedNavId === n.id
                      ? "bg-primary-600 text-white"
                      : "text-zinc-700 hover:bg-zinc-200/80"
                  }`}
                >
                  <span className="truncate font-medium">{n.label}</span>
                  <span
                    className={`tabular-nums text-xs ${
                      selectedNavId === n.id ? "text-white/80" : "text-zinc-500"
                    }`}
                  >
                    {n.count}
                  </span>
                </button>
              ))}
            </nav>
            <div className="border-t border-zinc-200 p-2">
              <button
                type="button"
                onClick={() => {
                  setNewGroupName("");
                  setCreateDialogOpen(true);
                }}
                className="tap-target inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
              >
                <FolderPlus className="h-4 w-4" />
                Nueva área
              </button>
            </div>
          </aside>
          <div className="min-w-0 flex-1 p-3 md:p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-zinc-900">{activeTitle}</h2>
              {activeGroup ? (
                <span className="inline-flex items-center gap-0.5">
                  <Link
                    href={`/assets/new?group=${activeGroup.id}`}
                    className="text-xs font-medium text-primary-600 hover:underline"
                  >
                    Nueva
                  </Link>
                  <button
                    type="button"
                    className="tap-target rounded p-1 text-zinc-500 hover:bg-zinc-200"
                    title="Editar área"
                    onClick={() =>
                      setEditGroup({
                        id: activeGroup.id,
                        name: activeGroup.name,
                      })
                    }
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className="tap-target rounded p-1 text-zinc-500 hover:bg-red-100 hover:text-red-700"
                    title="Eliminar área"
                    onClick={() => void deleteGroup(activeGroup.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </span>
              ) : null}
            </div>
            {items.length === 0 && groups.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-300 bg-white/70 p-8 text-center">
                <p className="text-zinc-500">Aún no hay máquinas.</p>
                <Link
                  href="/assets/new"
                  className="mt-3 inline-block font-medium text-primary-600"
                >
                  Añadir una
                </Link>
              </div>
            ) : scopedItems.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-300 bg-white/70 p-8 text-center">
                <p className="text-zinc-500">
                  {search.trim()
                    ? "No hay resultados para la búsqueda."
                    : "No hay máquinas en esta selección."}
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {scopedItems.map((asset) => (
                  <li key={asset.id}>
                    <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                      <Link
                        href={`/assets/${asset.id}`}
                        className="flex min-w-0 flex-1 items-center gap-3 tap-target"
                      >
                        <AssetPhotoThumb
                          assetId={asset.id}
                          hasImage={asset.imageUrl}
                          name={asset.name}
                          size="md"
                          cacheKey={asset.updatedAt}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-zinc-900">
                            {asset.name}
                          </p>
                          <p className="text-sm text-zinc-500">{asset.assetId}</p>
                        </div>
                      </Link>
                      <select
                        aria-label="Área"
                        className="max-w-[200px] rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        value={asset.groupId ?? ""}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          const v = e.target.value;
                          void moveAsset(asset.id, v === "" ? null : v);
                        }}
                      >
                        <option value="">Sin área</option>
                        {sortedGroups.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
