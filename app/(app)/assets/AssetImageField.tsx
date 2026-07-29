"use client";

import { useEffect, useRef, useState } from "react";
import { Factory, ImagePlus, X } from "lucide-react";

type AssetImageFieldProps = {
  /** Existing server URL (edit mode). */
  initialImageUrl?: string | null;
  /** Called when the user picks/clears a local file before create, or after remote upload. */
  onFileChange?: (file: File | null) => void;
  /** When set, uploads immediately to this asset id. */
  assetId?: string;
  onUploaded?: (imageUrl: string | null) => void;
  label?: string;
};

function AssetPhotoPlaceholder({
  size = "md",
  className = "",
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeClass =
    size === "sm" ? "h-10 w-10" : size === "lg" ? "h-28 w-28" : "h-12 w-12";
  const iconClass =
    size === "sm" ? "h-5 w-5" : size === "lg" ? "h-12 w-12" : "h-6 w-6";
  return (
    <div
      className={`${sizeClass} flex shrink-0 items-center justify-center rounded-lg border border-primary-100 bg-primary-50 text-primary-600/70 ${className}`}
      aria-hidden
    >
      <Factory className={iconClass} strokeWidth={1.75} />
    </div>
  );
}

export function AssetImageField({
  initialImageUrl = null,
  onFileChange,
  assetId,
  onUploaded,
  label = "Foto de la máquina",
}: AssetImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialImageUrl);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPreviewUrl(initialImageUrl);
  }, [initialImageUrl]);

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  async function applyFile(file: File | null) {
    setError(null);
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      setObjectUrl(null);
    }
    if (!file) {
      setPreviewUrl(initialImageUrl);
      onFileChange?.(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("Solo se permiten imágenes");
      return;
    }
    const local = URL.createObjectURL(file);
    setObjectUrl(local);
    setPreviewUrl(local);
    onFileChange?.(file);

    if (!assetId) return;

    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/assets/${assetId}/image`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "No se pudo subir la imagen");
        return;
      }
      const nextUrl = typeof data.imageUrl === "string" ? data.imageUrl : null;
      setPreviewUrl(nextUrl);
      onUploaded?.(nextUrl);
    } catch {
      setError("No se pudo subir la imagen");
    } finally {
      setBusy(false);
    }
  }

  async function removeImage() {
    setError(null);
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      setObjectUrl(null);
    }
    onFileChange?.(null);

    if (!assetId) {
      setPreviewUrl(null);
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/assets/${assetId}/image`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "No se pudo quitar la imagen");
        return;
      }
      setPreviewUrl(null);
      onUploaded?.(null);
    } catch {
      setError("No se pudo quitar la imagen");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <p className="block text-sm font-medium text-zinc-700">{label}</p>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative h-24 w-24 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Vista previa de la máquina"
              className="h-full w-full object-cover"
            />
          ) : (
            <AssetPhotoPlaceholder
              size="md"
              className="!h-full !w-full !rounded-xl !border-0"
            />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              void applyFile(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 tap-target hover:bg-zinc-50 disabled:opacity-50"
          >
            <ImagePlus className="h-4 w-4" aria-hidden />
            {busy ? "Subiendo…" : previewUrl ? "Cambiar foto" : "Añadir foto"}
          </button>
          {previewUrl ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void removeImage()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-600 tap-target hover:bg-zinc-50 disabled:opacity-50"
            >
              <X className="h-4 w-4" aria-hidden />
              Quitar
            </button>
          ) : null}
        </div>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

export function AssetPhotoThumb({
  imageUrl,
  name,
  size = "md",
}: {
  imageUrl?: string | null;
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass =
    size === "sm" ? "h-10 w-10" : size === "lg" ? "h-28 w-28" : "h-12 w-12";
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={name}
        className={`${sizeClass} shrink-0 rounded-lg border border-zinc-200 object-cover`}
      />
    );
  }
  return <AssetPhotoPlaceholder size={size} />;
}
