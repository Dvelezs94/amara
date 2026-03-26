"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileText, ExternalLink, Package, Upload, Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";

type FileWithAsset = {
  id: string;
  assetId: string | null;
  filename: string;
  fileUrl: string;
  category: string | null;
  createdAt: string;
  asset: { id: string; name: string; assetId: string } | null;
};

export default function KnowledgeBasePage() {
  const searchParams = useSearchParams();
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();
  const [files, setFiles] = useState<FileWithAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState("");

  function loadFiles() {
    setLoading(true);
    fetch("/api/knowledge-base")
      .then((r) => r.json())
      .then((data) => setFiles(Array.isArray(data) ? data : []))
      .catch(() => setFiles([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadFiles();
  }, []);

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const input = form.querySelector('input[type="file"]') as HTMLInputElement;
    if (!input?.files?.length) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", input.files[0]);
      if (category.trim()) formData.set("category", category.trim());
      const res = await fetch("/api/knowledge-base/upload", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setFiles((prev) => [data, ...prev]);
        input.value = "";
        setCategory("");
      }
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/asset-files/${id}`, { method: "DELETE" });
    if (res.ok) setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  const filteredFiles = useMemo(() => {
    if (!q) return files;
    return files.filter((f) => {
      const haystack = [
        f.filename,
        f.category,
        f.asset?.name,
        f.asset?.assetId,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [files, q]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-zinc-900">Base de conocimiento</h1>
      <p className="text-sm text-zinc-500">
        Archivos y documentación: sube aquí o desde la ficha de cada activo (manuales, especificaciones, etc.).
      </p>
      {q && (
        <p className="text-sm text-zinc-500">
          Buscando: <span className="font-medium text-zinc-700">{q}</span>
        </p>
      )}

      <form onSubmit={handleUpload} className="flex flex-wrap items-end gap-3 p-4 rounded-xl border border-zinc-200 bg-zinc-50/50">
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">Subir archivo aquí</label>
          <input
            type="file"
            name="file"
            className="block w-full text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-primary-50 file:px-3 file:py-2 file:text-primary-700"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">Categoría (opcional)</label>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Ej. Manual general"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 w-48"
          />
        </div>
        <button
          type="submit"
          disabled={uploading}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 text-white py-2 px-3 text-sm font-medium disabled:opacity-50"
        >
          <Upload className="h-4 w-4" />
          {uploading ? "Subiendo…" : "Subir"}
        </button>
      </form>

      {loading ? (
        <p className="text-zinc-500">Cargando…</p>
      ) : files.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 border-dashed bg-zinc-50 p-8 text-center">
          <FileText className="h-12 w-12 text-zinc-300 mx-auto mb-3" />
          <p className="text-zinc-600">Aún no hay archivos en la base de conocimiento</p>
          <p className="text-sm text-zinc-500 mt-1">
            Sube un archivo arriba o añade desde la ficha de cada activo.
          </p>
          <Link href="/assets" className="inline-block mt-4 text-primary-600 font-medium hover:underline">
            Ver maquinas
          </Link>
        </div>
      ) : filteredFiles.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center">
          <p className="text-zinc-600">No se encontraron archivos para esa busqueda.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
          <ul className="divide-y divide-zinc-100">
            {filteredFiles.map((f) => (
              <li key={f.id} className="flex items-center gap-4 p-4 hover:bg-zinc-50/50">
                <FileText className="h-5 w-5 text-zinc-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <a
                    href={f.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-zinc-900 hover:text-primary-600"
                  >
                    {f.filename}
                  </a>
                  {f.category && (
                    <p className="text-xs text-zinc-500 mt-0.5">{f.category}</p>
                  )}
                </div>
                {f.asset ? (
                  <Link
                    href={`/assets/${f.asset.id}`}
                    className="flex items-center gap-1.5 text-sm text-zinc-600 hover:text-primary-600 shrink-0"
                  >
                    <Package className="h-4 w-4" />
                    {f.asset.name} ({f.asset.assetId})
                  </Link>
                ) : (
                  <span className="text-sm text-zinc-400 shrink-0">Sin activo</span>
                )}
                <a
                  href={f.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 shrink-0"
                  aria-label="Abrir archivo"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
                <button
                  type="button"
                  onClick={() => handleDelete(f.id)}
                  className="p-2 rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-600 shrink-0"
                  aria-label="Eliminar"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
