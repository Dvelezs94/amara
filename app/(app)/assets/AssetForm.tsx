"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { sortAssetGroups } from "@/lib/asset-group-helpers";
import { AssetImageField } from "./AssetImageField";

type Group = {
  id: string;
  name: string;
  sortOrder: number;
};

export function AssetForm({ initialGroupId = null }: { initialGroupId?: string | null }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState(initialGroupId ?? "");
  const [imageFile, setImageFile] = useState<File | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/asset-groups")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data)) {
          setGroups(sortAssetGroups(data));
        }
      })
      .catch(() => {
        if (!cancelled) setGroups([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = e.currentTarget;
    const name = (form.elements.namedItem("name") as HTMLInputElement).value.trim();
    const assetId = (form.elements.namedItem("assetId") as HTMLInputElement).value.trim();
    const tracksMachineDowntime =
      (form.elements.namedItem("tracksMachineDowntime") as HTMLInputElement)?.checked !== false;
    try {
      const res = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          assetId,
          tracksMachineDowntime,
          groupId: groupId === "" ? null : groupId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Error al crear");
        setLoading(false);
        return;
      }
      const newId = data.id as string;
      if (imageFile && newId) {
        const fd = new FormData();
        fd.append("file", imageFile);
        const imgRes = await fetch(`/api/assets/${newId}/image`, {
          method: "POST",
          body: fd,
        });
        if (!imgRes.ok) {
          const imgData = await imgRes.json().catch(() => ({}));
          setError(
            imgData.error ??
              "Máquina creada, pero no se pudo subir la foto. Puedes añadirla al editar."
          );
          setLoading(false);
          router.push(`/assets/${newId}/edit`);
          router.refresh();
          return;
        }
      }
      router.push(`/assets/${newId}`);
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
      <AssetImageField onFileChange={setImageFile} />
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-zinc-700 mb-1">
          Nombre *
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
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
          placeholder="ej. AST-001"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>
      <div>
        <label htmlFor="groupId" className="block text-sm font-medium text-zinc-700 mb-1">
          Área
        </label>
        <select
          id="groupId"
          name="groupId"
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option value="">Sin área</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>
      <label className="flex items-start gap-2.5 text-sm text-zinc-800">
        <input
          id="tracksMachineDowntime"
          name="tracksMachineDowntime"
          type="checkbox"
          defaultChecked
          className="tap-target mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-300 text-primary-600 focus:ring-primary-500"
        />
        <span>
          Registrar paro de máquina en las tareas de este activo (desmarcar para desactivar el
          seguimiento)
        </span>
      </label>
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 rounded-xl bg-primary-600 text-white py-3 px-4 font-medium tap-target disabled:opacity-60"
        >
          {loading ? "Creando…" : "Crear"}
        </button>
        <Link
          href="/assets"
          className="rounded-xl border border-zinc-300 py-3 px-4 font-medium text-zinc-700 tap-target"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
