"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type AssetEditFormProps = {
  id: string;
  initialName: string;
  initialAssetId: string;
  initialTracksMachineDowntime: boolean;
};

export function AssetEditForm({
  id,
  initialName,
  initialAssetId,
  initialTracksMachineDowntime,
}: AssetEditFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = e.currentTarget;
    const name = (form.elements.namedItem("name") as HTMLInputElement).value.trim();
    const assetId = (form.elements.namedItem("assetId") as HTMLInputElement).value.trim();
    const tracksMachineDowntime =
      (form.elements.namedItem("tracksMachineDowntime") as HTMLInputElement)?.checked === true;

    try {
      const res = await fetch(`/api/assets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, assetId, tracksMachineDowntime }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Error al actualizar");
        setLoading(false);
        return;
      }
      router.push(`/assets/${id}`);
      router.refresh();
    } catch {
      setError("Algo salió mal");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{error}</p>
      )}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-zinc-700 mb-1">
          Nombre *
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={initialName}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>
      <div>
        <label htmlFor="assetId" className="block text-sm font-medium text-zinc-700 mb-1">
          ID del activo *
        </label>
        <input
          id="assetId"
          name="assetId"
          type="text"
          required
          defaultValue={initialAssetId}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>
      <label className="flex items-start gap-2.5 text-sm text-zinc-800">
        <input
          id="tracksMachineDowntime"
          name="tracksMachineDowntime"
          type="checkbox"
          defaultChecked={initialTracksMachineDowntime}
          className="tap-target mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-300 text-primary-600 focus:ring-primary-500"
        />
        <span>
          Registrar paro de máquina en las tareas de este activo
        </span>
      </label>
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 rounded-xl bg-primary-600 text-white py-3 px-4 font-medium tap-target disabled:opacity-60"
        >
          {loading ? "Guardando..." : "Guardar cambios"}
        </button>
        <Link
          href={`/assets/${id}`}
          className="rounded-xl border border-zinc-300 py-3 px-4 font-medium text-zinc-700 tap-target"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
