"use client";

import { useState } from "react";
import { FileText, Upload, Trash2, ExternalLink } from "lucide-react";

type AssetFile = {
  id: string;
  assetId: string | null;
  filename: string;
  fileUrl: string;
  category: string | null;
  createdAt: string | Date;
};

export function AssetFilesSection({
  assetId,
  initialFiles,
}: {
  assetId: string;
  initialFiles: AssetFile[];
}) {
  const [files, setFiles] = useState<AssetFile[]>(initialFiles);
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState("");

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
      const res = await fetch(`/api/assets/${assetId}/files`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setFiles((prev) => [{ ...data, createdAt: new Date().toISOString() }, ...prev]);
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

  return (
    <section>
      <h2 className="text-sm font-medium text-zinc-500 mb-2">Archivos y documentación</h2>
      <p className="text-sm text-zinc-600 mb-3">
        Añade manuales, especificaciones y otros documentos al activo.
      </p>

      <form onSubmit={handleUpload} className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">Archivo</label>
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
            placeholder="Ej. Manual de usuario"
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

      {files.length === 0 ? (
        <p className="text-sm text-zinc-500 rounded-lg border border-zinc-200 border-dashed p-4">
          Aún no hay archivos. Sube manuales o documentación arriba.
        </p>
      ) : (
        <ul className="space-y-2">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-3"
            >
              <FileText className="h-5 w-5 text-zinc-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <a
                  href={f.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-zinc-900 hover:text-primary-600 truncate block"
                >
                  {f.filename}
                </a>
                {f.category && (
                  <p className="text-xs text-zinc-500">{f.category}</p>
                )}
              </div>
              <a
                href={f.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                aria-label="Abrir"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
              <button
                type="button"
                onClick={() => handleDelete(f.id)}
                className="p-2 rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-600"
                aria-label="Eliminar"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
