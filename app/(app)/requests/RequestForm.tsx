"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Asset = { id: string; name: string; assetId: string };

export function RequestForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);

  useEffect(() => {
    fetch("/api/assets")
      .then((r) => r.json())
      .then((d) => setAssets(Array.isArray(d) ? d : []))
      .catch(() => setAssets([]));
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = e.currentTarget;
    const description = (form.elements.namedItem("description") as HTMLTextAreaElement).value.trim();
    const assetId = (form.elements.namedItem("assetId") as HTMLSelectElement).value || undefined;
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, assetId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Error al enviar");
        setLoading(false);
        return;
      }
      router.push("/requests");
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
        <label htmlFor="description" className="block text-sm font-medium text-zinc-700 mb-1">
          ¿Qué necesitas? *
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          required
          placeholder="Describe el problema o el mantenimiento necesario…"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>
      <div>
        <label htmlFor="assetId" className="block text-sm font-medium text-zinc-700 mb-1">
          Activo (opcional)
        </label>
        <select
          id="assetId"
          name="assetId"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option value="">Ninguno</option>
          {assets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.assetId})
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 rounded-xl bg-primary-600 text-white py-3 px-4 font-medium tap-target disabled:opacity-60"
        >
          {loading ? "Enviando…" : "Enviar solicitud"}
        </button>
        <Link
          href="/requests"
          className="rounded-xl border border-zinc-300 py-3 px-4 font-medium text-zinc-700 tap-target"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
