import { db } from "@/lib/db";
import {
  maintenanceSchedules,
  assets,
  checklistTemplates,
} from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

function formatDate(value: Date | null) {
  if (!value) return "Sin fecha programada";
  return new Date(value).toLocaleDateString("es-MX", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function CalendarioPage() {
  const schedules = await db
    .select({
      id: maintenanceSchedules.id,
      name: maintenanceSchedules.name,
      recurrence: maintenanceSchedules.recurrence,
      nextRunAt: maintenanceSchedules.nextRunAt,
      assetName: assets.name,
      assetCode: assets.assetId,
      checklistName: checklistTemplates.name,
    })
    .from(maintenanceSchedules)
    .leftJoin(assets, eq(maintenanceSchedules.assetId, assets.id))
    .leftJoin(
      checklistTemplates,
      eq(maintenanceSchedules.checklistTemplateId, checklistTemplates.id)
    )
    .orderBy(asc(maintenanceSchedules.nextRunAt), asc(maintenanceSchedules.name));

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-zinc-900">Calendario</h1>
        <p className="text-sm text-zinc-500">
          Muestra todas las tareas de mantenimiento preventivo programadas.
        </p>
      </header>

      {schedules.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500">
          Aún no hay mantenimientos programados.
        </div>
      ) : (
        <ul className="space-y-2">
          {schedules.map((task) => (
            <li
              key={task.id}
              className="rounded-xl border border-zinc-200 bg-white p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-zinc-900">{task.name}</p>
                  <p className="text-xs text-zinc-500">
                    Frecuencia: {task.recurrence}
                  </p>
                </div>
                <span className="rounded-full bg-primary-50 px-2 py-1 text-xs font-medium text-primary-700">
                  {formatDate(task.nextRunAt)}
                </span>
              </div>
              <div className="mt-2 grid gap-1 text-sm text-zinc-600 md:grid-cols-2">
                <p>
                  Activo:{" "}
                  {task.assetName
                    ? `${task.assetName}${task.assetCode ? ` (${task.assetCode})` : ""}`
                    : "Sin activo asignado"}
                </p>
                <p>
                  Checklist: {task.checklistName ?? "Sin checklist asignado"}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
