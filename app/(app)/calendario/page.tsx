import { db } from "@/lib/db";
import {
  maintenanceSchedules,
  assets,
  checklistTemplates,
  users,
} from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { formatRecurrenceLabel } from "@/lib/maintenance-recurrence";
import { MaintenanceAssigneeSelect } from "./MaintenanceAssigneeSelect";
import { CalendarMonthView } from "./CalendarMonthView";
import { CreateMaintenanceEventForm } from "./CreateMaintenanceEventForm";

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
  const userList = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .orderBy(users.name);

  const schedules = await db
    .select({
      id: maintenanceSchedules.id,
      name: maintenanceSchedules.name,
      recurrence: maintenanceSchedules.recurrence,
      nextRunAt: maintenanceSchedules.nextRunAt,
      assigneeId: maintenanceSchedules.assigneeId,
      assigneeName: users.name,
      assetName: assets.name,
      assetCode: assets.assetId,
      checklistName: checklistTemplates.name,
    })
    .from(maintenanceSchedules)
    .leftJoin(assets, eq(maintenanceSchedules.assetId, assets.id))
    .leftJoin(users, eq(maintenanceSchedules.assigneeId, users.id))
    .leftJoin(
      checklistTemplates,
      eq(maintenanceSchedules.checklistTemplateId, checklistTemplates.id)
    )
    .orderBy(asc(maintenanceSchedules.nextRunAt), asc(maintenanceSchedules.name));

  const assetOptions = await db
    .select({
      id: assets.id,
      name: assets.name,
      assetId: assets.assetId,
    })
    .from(assets)
    .orderBy(assets.name);

  const templateOptions = await db
    .select({ id: checklistTemplates.id, name: checklistTemplates.name })
    .from(checklistTemplates)
    .orderBy(checklistTemplates.name);

  const calendarSchedules = schedules.map((s) => ({
    id: s.id,
    name: s.name,
    recurrence: s.recurrence,
    nextRunAt: s.nextRunAt ? s.nextRunAt.toISOString() : null,
  }));

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-zinc-900">Calendario</h1>
        <p className="text-sm text-zinc-500">
          Vista mensual y tareas de mantenimiento preventivo con repetición
          (diaria, semanal, mensual, etc.).
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <CalendarMonthView schedules={calendarSchedules} />
        </div>
        <div className="lg:col-span-2">
          <CreateMaintenanceEventForm
            assets={assetOptions.map((a) => ({
              id: a.id,
              name: a.name,
              sublabel: a.assetId,
            }))}
            users={userList}
            checklistTemplates={templateOptions}
          />
        </div>
      </div>

      <h2 className="text-sm font-semibold text-zinc-800">Lista de programaciones</h2>

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
                    Frecuencia: {formatRecurrenceLabel(task.recurrence)}
                  </p>
                </div>
                <span className="rounded-full bg-primary-50 px-2 py-1 text-xs font-medium text-primary-700">
                  {formatDate(task.nextRunAt)}
                </span>
              </div>
              <div className="mt-3 grid gap-3 text-sm text-zinc-600 md:grid-cols-2">
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
              <div className="mt-3 border-t border-zinc-100 pt-3">
                {task.assigneeName && (
                  <p className="mb-2 text-xs text-zinc-500">
                    Asignado actualmente:{" "}
                    <span className="font-medium text-zinc-700">
                      {task.assigneeName}
                    </span>
                  </p>
                )}
                <MaintenanceAssigneeSelect
                  scheduleId={task.id}
                  users={userList}
                  assigneeId={task.assigneeId}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
