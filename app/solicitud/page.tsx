"use client";

import Link from "next/link";
import { useState } from "react";

export default function SolicitudPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    const form = e.currentTarget;
    const titulo = (form.elements.namedItem("titulo") as HTMLInputElement).value.trim();
    const descripcion = (form.elements.namedItem("descripcion") as HTMLTextAreaElement).value.trim();
    const nombreContacto = (form.elements.namedItem("nombreContacto") as HTMLInputElement).value.trim();
    const emailContacto = (form.elements.namedItem("emailContacto") as HTMLInputElement).value.trim();

    try {
      const res = await fetch("/api/solicitud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titulo, descripcion, nombreContacto, emailContacto }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "No se pudo enviar la solicitud.");
        setLoading(false);
        return;
      }
      setSuccess(
        `Solicitud enviada correctamente. Folio de orden: ${data.workOrderId}`
      );
      form.reset();
    } catch {
      setError("No se pudo enviar la solicitud.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface p-6">
      <div className="mx-auto max-w-lg space-y-5">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold text-zinc-900">
            Crear solicitud de mantenimiento
          </h1>
          <p className="text-sm text-zinc-600">
            Reporta una falla o necesidad de mantenimiento. Se generara una orden
            abierta para atencion del equipo.
          </p>
        </header>
        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4"
        >
          {error && (
            <p className="rounded-lg bg-red-50 p-2 text-sm text-red-600">{error}</p>
          )}
          {success && (
            <p className="rounded-lg bg-emerald-50 p-2 text-sm text-emerald-700">
              {success}
            </p>
          )}
          <div>
            <label htmlFor="titulo" className="mb-1 block text-sm font-medium text-zinc-700">
              Titulo *
            </label>
            <input
              id="titulo"
              name="titulo"
              required
              type="text"
              placeholder="Ej: Horno HT-01 no alcanza temperatura"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div>
            <label htmlFor="descripcion" className="mb-1 block text-sm font-medium text-zinc-700">
              Descripcion *
            </label>
            <textarea
              id="descripcion"
              name="descripcion"
              required
              rows={5}
              placeholder="Describe el problema, sintomas y area del equipo."
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div>
            <label
              htmlFor="nombreContacto"
              className="mb-1 block text-sm font-medium text-zinc-700"
            >
              Nombre de contacto (opcional)
            </label>
            <input
              id="nombreContacto"
              name="nombreContacto"
              type="text"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div>
            <label
              htmlFor="emailContacto"
              className="mb-1 block text-sm font-medium text-zinc-700"
            >
              Email de contacto (opcional)
            </label>
            <input
              id="emailContacto"
              name="emailContacto"
              type="email"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-primary-600 px-4 py-3 font-medium text-white tap-target disabled:opacity-60"
          >
            {loading ? "Enviando..." : "Enviar solicitud"}
          </button>
        </form>
        <div className="text-center text-sm">
          <Link href="/login" className="font-medium text-primary-600">
            Volver al login
          </Link>
        </div>
      </div>
    </div>
  );
}
