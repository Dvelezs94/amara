"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  FoldVertical,
  Folder,
  FolderPlus,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  folderDescendantIds,
  filterChecklistsBySearch,
  type FolderRow,
} from "@/lib/checklist-folder-helpers";
import { useSetPageHeader } from "@/components/PageHeaderContext";

type Folder = {
  id: string;
  name: string;
  parentFolderId: string | null;
  sortOrder: number;
};

type Template = {
  id: string;
  name: string;
  description: string | null;
  folderId: string | null;
};

function sortFolders(fs: Folder[]): Folder[] {
  return [...fs].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "es")
  );
}

function folderPath(folderId: string, byId: Map<string, Folder>): string {
  const parts: string[] = [];
  let cur: string | null = folderId;
  const guard = new Set<string>();
  while (cur && !guard.has(cur)) {
    guard.add(cur);
    const f = byId.get(cur);
    if (!f) break;
    parts.unshift(f.name);
    cur = f.parentFolderId;
  }
  return parts.join(" / ");
}

export function ChecklistList({ canCreate = true }: { canCreate?: boolean }) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});
  const [folderDialog, setFolderDialog] = useState<{
    parentId: string | null;
  } | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [editFolder, setEditFolder] = useState<{
    id: string;
    name: string;
    parentFolderId: string | null;
  } | null>(null);

  const allFoldersCollapsed =
    folders.length > 0 && folders.every((f) => openFolders[f.id] === false);

  useSetPageHeader({
    title: "Checklist",
    filters: (
      <>
        <input
          type="search"
          placeholder="Buscar plantillas o carpetas…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder:text-zinc-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 md:max-w-md"
        />
        <button
          type="button"
          disabled={folders.length === 0}
          title={
            allFoldersCollapsed
              ? "Expandir todas las carpetas"
              : "Contraer todas las carpetas"
          }
          aria-label={
            allFoldersCollapsed
              ? "Expandir todas las carpetas"
              : "Contraer todas las carpetas"
          }
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-2.5 py-2 text-sm font-medium text-zinc-800 tap-target hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => {
            setOpenFolders(
              Object.fromEntries(
                folders.map((f) => [f.id, allFoldersCollapsed])
              )
            );
          }}
        >
          <FoldVertical className="h-4 w-4" />
          <span className="hidden sm:inline">
            {allFoldersCollapsed ? "Expandir todo" : "Contraer todo"}
          </span>
        </button>
      </>
    ),
    actions: canCreate ? (
      <>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-2.5 py-2 text-sm font-medium text-zinc-800 tap-target hover:bg-zinc-50"
          onClick={() => {
            setNewFolderName("");
            setFolderDialog({ parentId: null });
          }}
        >
          <FolderPlus className="h-4 w-4" />
          <span className="hidden sm:inline">Nueva carpeta</span>
        </button>
        <Link
          href="/checklists/new"
          className="rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white tap-target hover:bg-primary-700"
        >
          Nueva plantilla
        </Link>
      </>
    ) : null,
  });

  const reload = useCallback(async () => {
    const [fr, tr] = await Promise.all([
      fetch("/api/checklist-folders"),
      fetch("/api/checklist-templates"),
    ]);
    const fa = await fr.json().catch(() => []);
    const ta = await tr.json().catch(() => []);
    setFolders(Array.isArray(fa) ? fa : []);
    setTemplates(Array.isArray(ta) ? ta : []);
  }, []);

  useEffect(() => {
    reload()
      .catch(() => {
        setFolders([]);
        setTemplates([]);
      })
      .finally(() => setLoading(false));
  }, [reload]);

  useEffect(() => {
    setOpenFolders((prev) => {
      const next = { ...prev };
      for (const f of folders) {
        if (next[f.id] === undefined) next[f.id] = true;
      }
      return next;
    });
  }, [folders]);

  const searchResult = useMemo(
    () => filterChecklistsBySearch(folders, templates, search),
    [folders, templates, search]
  );

  const visibleTemplates = searchResult.templates;
  const visibleFolderIds = searchResult.visibleFolderIds;

  useEffect(() => {
    if (!searchResult.searching) return;
    const ids = searchResult.openFolderIds;
    if (ids.size === 0) return;
    setOpenFolders((prev) => {
      let changed = false;
      const next = { ...prev };
      Array.from(ids).forEach((id) => {
        if (next[id] !== true) {
          next[id] = true;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [search, searchResult.searching, searchResult.openFolderIds]);

  const byId = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders]);

  const folderRows: FolderRow[] = useMemo(
    () =>
      folders.map((f) => ({
        id: f.id,
        parentFolderId: f.parentFolderId,
      })),
    [folders]
  );

  const folderOptionsForTemplate = useMemo(() => {
    return sortFolders(folders).map((f) => ({
      id: f.id,
      label: folderPath(f.id, byId),
    }));
  }, [folders, byId]);

  const excludedParentsForFolder = useCallback(
    (folderId: string) => {
      const ex = new Set<string>([folderId]);
      folderDescendantIds(folderId, folderRows).forEach((id) => ex.add(id));
      return ex;
    },
    [folderRows]
  );

  async function createFolder() {
    const name = newFolderName.trim();
    if (!name || !folderDialog) return;
    const res = await fetch("/api/checklist-folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        parentFolderId: folderDialog.parentId,
      }),
    });
    if (res.ok) {
      setNewFolderName("");
      setFolderDialog(null);
      await reload();
    }
  }

  async function deleteFolder(id: string) {
    if (
      !window.confirm(
        "¿Eliminar esta carpeta? Las subcarpetas también se eliminarán. Las plantillas pasarán a «sin carpeta»."
      )
    ) {
      return;
    }
    const res = await fetch(`/api/checklist-folders/${id}`, { method: "DELETE" });
    if (res.ok) await reload();
  }

  async function saveEditFolder() {
    if (!editFolder) return;
    const name = editFolder.name.trim();
    if (!name) return;
    const original = folders.find((f) => f.id === editFolder.id);
    if (!original) {
      setEditFolder(null);
      return;
    }
    const body: { name?: string; parentFolderId?: string | null } = {};
    if (name !== original.name) body.name = name;
    const nextParent = editFolder.parentFolderId;
    const prevParent = original.parentFolderId ?? null;
    if (nextParent !== prevParent) body.parentFolderId = nextParent;
    if (Object.keys(body).length === 0) {
      setEditFolder(null);
      return;
    }
    const res = await fetch(`/api/checklist-folders/${editFolder.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setEditFolder(null);
      await reload();
    }
  }

  async function moveTemplate(templateId: string, folderId: string | null) {
    const res = await fetch(`/api/checklist-templates/${templateId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderId }),
    });
    if (res.ok) await reload();
  }

  function toggleFolder(id: string) {
    setOpenFolders((o) => ({ ...o, [id]: !o[id] }));
  }

  function renderTemplatesBlock(list: Template[]) {
    if (list.length === 0) return null;
    return (
      <ul className="space-y-2 pl-1">
        {list.map((t) => (
          <li key={t.id}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-zinc-200 bg-white p-4 hover:border-primary-200 hover:bg-primary-50/50 transition">
              <Link
                href={`/checklists/${t.id}`}
                className="flex min-w-0 flex-1 items-center justify-between gap-2 tap-target"
              >
                <div className="min-w-0">
                  <p className="font-medium text-zinc-900">{t.name}</p>
                  {t.description && (
                    <p className="mt-0.5 text-sm text-zinc-500 line-clamp-1">
                      {t.description}
                    </p>
                  )}
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-zinc-400" />
              </Link>
              {canCreate && (
                <label className="flex shrink-0 items-center gap-2 text-sm text-zinc-600">
                  <span className="hidden sm:inline">Carpeta</span>
                  <select
                    className="max-w-[220px] rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm"
                    value={t.folderId ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      void moveTemplate(t.id, v === "" ? null : v);
                    }}
                  >
                    <option value="">Sin carpeta</option>
                    {folderOptionsForTemplate.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          </li>
        ))}
      </ul>
    );
  }

  function renderFolderNode(folder: Folder, depth: number): ReactNode {
    if (visibleFolderIds && !visibleFolderIds.has(folder.id)) return null;

    const children = sortFolders(
      folders.filter(
        (f) =>
          f.parentFolderId === folder.id &&
          (!visibleFolderIds || visibleFolderIds.has(f.id))
      )
    );
    const here = visibleTemplates.filter((t) => t.folderId === folder.id);
    const isOpen = openFolders[folder.id] !== false;
    const pad = Math.min(depth * 12, 48);

    return (
      <div key={folder.id} className="space-y-2" style={{ marginLeft: pad }}>
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50/80 px-3 py-2">
          <button
            type="button"
            onClick={() => toggleFolder(folder.id)}
            className="tap-target flex items-center gap-1 text-zinc-700"
            aria-expanded={isOpen}
          >
            {isOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <Folder className="h-4 w-4 text-primary-600" />
            <span className="font-medium text-zinc-900">{folder.name}</span>
          </button>
          {canCreate && (
            <>
              <Link
                href={`/checklists/new?folder=${folder.id}`}
                className="text-xs font-medium text-primary-600 hover:underline"
              >
                Nueva plantilla aquí
              </Link>
              <button
                type="button"
                className="tap-target rounded p-1 text-zinc-500 hover:bg-zinc-200"
                title="Subcarpeta"
                onClick={() => {
                  setNewFolderName("");
                  setFolderDialog({ parentId: folder.id });
                }}
              >
                <FolderPlus className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="tap-target rounded p-1 text-zinc-500 hover:bg-zinc-200"
                title="Editar carpeta"
                onClick={() =>
                  setEditFolder({
                    id: folder.id,
                    name: folder.name,
                    parentFolderId: folder.parentFolderId ?? null,
                  })
                }
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="tap-target rounded p-1 text-zinc-500 hover:bg-red-100 hover:text-red-700"
                title="Eliminar carpeta"
                onClick={() => void deleteFolder(folder.id)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
        {isOpen && (
          <div className="space-y-3">
            {children.map((ch) => renderFolderNode(ch, depth + 1))}
            {renderTemplatesBlock(here)}
          </div>
        )}
      </div>
    );
  }

  const editFolderModal =
    editFolder && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-lg space-y-3 text-left">
          <h2 className="font-semibold text-zinc-900">Editar carpeta</h2>
          <label className="block text-sm text-zinc-600">
            Nombre
            <input
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2"
              value={editFolder.name}
              onChange={(e) =>
                setEditFolder((prev) =>
                  prev ? { ...prev, name: e.target.value } : null
                )
              }
              autoFocus
            />
          </label>
          <label className="block text-sm text-zinc-600">
            Ubicación
            <select
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2"
              value={editFolder.parentFolderId ?? ""}
              onChange={(e) =>
                setEditFolder((prev) =>
                  prev
                    ? {
                        ...prev,
                        parentFolderId:
                          e.target.value === "" ? null : e.target.value,
                      }
                    : null
                )
              }
            >
              <option value="">Raíz</option>
              {sortFolders(folders)
                .filter((f) => !excludedParentsForFolder(editFolder.id).has(f.id))
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {folderPath(f.id, byId)}
                  </option>
                ))}
            </select>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="rounded-lg px-3 py-2 text-sm text-zinc-600"
              onClick={() => setEditFolder(null)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white"
              onClick={() => void saveEditFolder()}
            >
              Guardar
            </button>
          </div>
        </div>
      </div>
    );

  const folderModal =
    folderDialog && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-lg space-y-3 text-left">
          <h2 className="font-semibold text-zinc-900">Nueva carpeta</h2>
          <label className="block text-sm text-zinc-600">
            Nombre
            <input
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              autoFocus
            />
          </label>
          <label className="block text-sm text-zinc-600">
            Dentro de
            <select
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2"
              value={folderDialog.parentId ?? ""}
              onChange={(e) =>
                setFolderDialog({
                  parentId: e.target.value === "" ? null : e.target.value,
                })
              }
            >
              <option value="">Raíz</option>
              {folderOptionsForTemplate.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="rounded-lg px-3 py-2 text-sm text-zinc-600"
              onClick={() => setFolderDialog(null)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white"
              onClick={() => void createFolder()}
            >
              Crear
            </button>
          </div>
        </div>
      </div>
    );

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 rounded-xl bg-zinc-100 animate-pulse"
              aria-hidden
            />
          ))}
        </div>
      </div>
    );
  }

  const roots = sortFolders(
    folders.filter(
      (f) =>
        !f.parentFolderId &&
        (!visibleFolderIds || visibleFolderIds.has(f.id))
    )
  );
  const loose = visibleTemplates.filter((t) => !t.folderId);
  const hasAnything = templates.length > 0 || folders.length > 0;
  const hasSearchHits =
    !searchResult.searching ||
    visibleTemplates.length > 0 ||
    (visibleFolderIds != null && visibleFolderIds.size > 0);

  if (!hasAnything) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center">
          <p className="text-zinc-500">Aún no hay plantillas de checklist.</p>
          <p className="text-sm text-zinc-400 mt-1">
            Crea carpetas para organizarlas y luego añade plantillas con pasos y campos.
          </p>
        </div>
        {folderModal}
        {editFolderModal}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!hasSearchHits ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white/70 p-8 text-center">
          <p className="text-zinc-500">No hay resultados para la búsqueda.</p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {roots.map((r) => renderFolderNode(r, 0))}
          </div>

          {loose.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-zinc-600">
                {folders.length > 0 ? "Sin carpeta" : "Plantillas"}
              </p>
              {renderTemplatesBlock(loose)}
            </div>
          )}
        </>
      )}

      {folderModal}
      {editFolderModal}
    </div>
  );
}
