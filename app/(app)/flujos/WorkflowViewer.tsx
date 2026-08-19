"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { WorkflowActionConfig, WorkflowTriggerType } from "@/lib/workflows";
import { WorkflowCanvas } from "./WorkflowCanvas";

export type WorkflowRunPreview = {
  id: string;
  status: string;
  error: string | null;
  createdAt: Date;
};

export function WorkflowViewer({
  workflowId,
  enabled: initialEnabled,
  triggerType,
  toStatus,
  actions,
  runs,
}: {
  workflowId: string;
  enabled: boolean;
  triggerType: WorkflowTriggerType;
  toStatus: string;
  actions: WorkflowActionConfig[];
  runs: WorkflowRunPreview[];
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [error, setError] = useState<string | null>(null);

  async function toggleEnabled() {
    setError(null);
    const res = await fetch(`/api/workflows/${workflowId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !enabled }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "No se pudo actualizar");
      return;
    }
    setEnabled(!enabled);
    router.refresh();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-zinc-300 bg-[#111827] shadow-sm">
      <div className="flex shrink-0 items-center gap-3 border-b border-white/10 bg-[#0b1220] px-3 py-2">
        <label className="flex items-center gap-1.5 text-xs text-zinc-300">
          <input
            type="checkbox"
            checked={enabled}
            onChange={() => void toggleEnabled()}
            className="h-4 w-4 rounded border-zinc-500 accent-accent-500"
          />
          Activo
        </label>
        <p className="ml-auto text-[11px] text-zinc-500">Solo lectura</p>
      </div>
      {error ? (
        <p className="shrink-0 bg-red-950/80 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}
      <WorkflowCanvas
        triggerType={triggerType}
        toStatus={toStatus}
        actions={actions}
      />
      {runs.length > 0 ? (
        <section className="max-h-36 shrink-0 overflow-y-auto border-t border-white/10 bg-[#0b1220] px-3 py-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
            Últimas ejecuciones
          </h2>
          <ul className="mt-1 space-y-1 text-xs text-zinc-300">
            {runs.map((run) => (
              <li key={run.id}>
                <span className="font-medium text-white">
                  {run.status === "ok"
                    ? "OK"
                    : run.status === "partial"
                      ? "Parcial"
                      : "Error"}
                </span>
                {" · "}
                {run.createdAt.toLocaleString("es-MX")}
                {run.error ? ` · ${run.error}` : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
