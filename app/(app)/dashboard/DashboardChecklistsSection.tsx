"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronLeft, ChevronRight, ClipboardList } from "lucide-react";
import { APP_TIME_ZONE } from "@/lib/timezone";
import { shiftYmd, todayYmdInAppTimeZone } from "@/lib/dashboard-checklists";
import { dashboardEmptyCopy } from "@/lib/dashboard-presentation";

type DashboardChecklistEntry = {
  workOrderId: string;
  workOrderTitle: string;
  workOrderStatus: "pending" | "in_progress" | "completed" | "cancelled";
  templateName: string;
  completedCount: number;
  totalCount: number;
  isPriority: boolean;
};

function formatDayLabel(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return date.toLocaleDateString("es-MX", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: APP_TIME_ZONE,
  });
}

function statusLabel(status: DashboardChecklistEntry["workOrderStatus"]): string {
  if (status === "pending") return "Pendiente";
  if (status === "in_progress") return "En progreso";
  if (status === "completed") return "Completada";
  return "Cancelada";
}

export function DashboardChecklistsSection() {
  const [dateYmd, setDateYmd] = useState(() => todayYmdInAppTimeZone());
  const [entries, setEntries] = useState<DashboardChecklistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const empty = dashboardEmptyCopy.checklists;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/dashboard/checklists?date=${encodeURIComponent(dateYmd)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("checklists");
        return response.json();
      })
      .then((data) => {
        if (cancelled) return;
        setEntries(Array.isArray(data?.checklists) ? data.checklists : []);
      })
      .catch(() => {
        if (cancelled) return;
        setEntries([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dateYmd]);

  function shiftDay(delta: number) {
    const next = shiftYmd(dateYmd, delta);
    if (next) setDateYmd(next);
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-600">
            <ClipboardList className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Checklists del día</h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              Tareas con checklist con actividad en la fecha seleccionada
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => shiftDay(-1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
            aria-label="Día anterior"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <span className="min-w-[10rem] px-2 text-center text-xs font-medium capitalize text-zinc-700 sm:text-sm">
            {formatDayLabel(dateYmd)}
          </span>
          <button
            type="button"
            onClick={() => shiftDay(1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
            aria-label="Día siguiente"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2" aria-busy="true" aria-label="Cargando checklists">
          <div className="h-20 animate-pulse rounded-lg bg-zinc-200" />
          <div className="h-20 animate-pulse rounded-lg bg-zinc-200" />
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center rounded-lg border border-dashed border-zinc-200 bg-zinc-50/80 px-4 py-8 text-center">
          <p className="text-sm text-zinc-600">{empty.message}</p>
          <Link
            href={empty.href}
            className="mt-2 text-sm font-medium text-primary-600 hover:underline"
          >
            {empty.cta}
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => (
            <li
              key={entry.workOrderId}
              className={`rounded-lg border p-3 transition-colors hover:border-primary-200 ${
                entry.isPriority
                  ? "border-accent-200 bg-accent-50/60 hover:bg-accent-50"
                  : "border-zinc-200 bg-zinc-50/80 hover:bg-primary-50/40"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <ClipboardList className="h-4 w-4 shrink-0 text-primary-600" aria-hidden />
                    <Link
                      href={`/tareas/${entry.workOrderId}`}
                      className="font-medium text-zinc-900 hover:text-primary-600"
                    >
                      {entry.workOrderTitle}
                    </Link>
                    {entry.isPriority ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-accent-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                        <AlertTriangle className="h-3 w-3" aria-hidden />
                        Prioridad
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-zinc-600">{entry.templateName}</p>
                </div>
                <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-medium text-zinc-600 ring-1 ring-zinc-200">
                  {statusLabel(entry.workOrderStatus)}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 text-xs text-zinc-500">
                <span>
                  Progreso: {entry.completedCount}/{entry.totalCount}
                </span>
                {entry.isPriority ? (
                  <span className="font-medium text-accent-700">
                    Revisar: posible NO OK o comentarios
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
