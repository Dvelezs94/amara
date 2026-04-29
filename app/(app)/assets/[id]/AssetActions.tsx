"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";

type AssetActionsProps = {
  id: string;
  name: string;
};

export function AssetActions({ id, name }: AssetActionsProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    const confirmed = window.confirm(
      `¿Eliminar la máquina "${name}"? Esta acción no se puede deshacer.`
    );
    if (!confirmed) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/assets/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "No se pudo eliminar.");
        return;
      }
      router.push("/assets");
      router.refresh();
    } catch {
      setError("No se pudo eliminar.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/assets/${id}/edit`}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 tap-target disabled:opacity-60"
        aria-label="Editar máquina"
        title="Editar"
      >
        <Pencil className="h-4 w-4" />
      </Link>
      <button
        type="button"
        onClick={onDelete}
        disabled={submitting}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-zinc-600 hover:bg-red-50 hover:text-red-700 tap-target disabled:opacity-60"
        aria-label="Eliminar máquina"
        title="Eliminar"
      >
        <Trash2 className="h-4 w-4" />
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
