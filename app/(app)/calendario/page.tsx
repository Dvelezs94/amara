import { db } from "@/lib/db";
import {
  maintenanceSchedules,
  assets,
  checklistTemplates,
  users,
} from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import { CalendarMonthView } from "./CalendarMonthView";
import { CalendarCreateEventModal } from "./CalendarCreateEventModal";

export const dynamic = "force-dynamic";

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
      color: maintenanceSchedules.color,
      nextRunAt: maintenanceSchedules.nextRunAt,
    })
    .from(maintenanceSchedules)
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
    color: s.color,
    nextRunAt: s.nextRunAt ? s.nextRunAt.toISOString() : null,
  }));

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight text-zinc-900">Calendario</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Vista mensual y tareas de mantenimiento preventivo con repetición
            (diaria, semanal, mensual, etc.).
          </p>
        </div>
        <CalendarCreateEventModal
          assets={assetOptions.map((a) => ({
            id: a.id,
            name: a.name,
            sublabel: a.assetId,
          }))}
          users={userList}
          checklistTemplates={templateOptions}
        />
      </header>

      <CalendarMonthView schedules={calendarSchedules} />
    </div>
  );
}
