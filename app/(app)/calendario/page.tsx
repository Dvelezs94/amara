import { db } from "@/lib/db";
import {
  maintenanceSchedules,
  assets,
  checklistTemplates,
  users,
} from "@/lib/db/schema";
import { loadManyMaintenanceScheduleAssigneeIds } from "@/lib/assignees";
import { asc, desc, isNotNull, isNull } from "drizzle-orm";
import { CalendarMonthView } from "./CalendarMonthView";
import { CalendarCreateEventModal } from "./CalendarCreateEventModal";
import { DeletedSchedulesSection } from "./DeletedSchedulesSection";

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
      assigneeId: maintenanceSchedules.assigneeId,
      nextRunAt: maintenanceSchedules.nextRunAt,
      checklistTemplateId: maintenanceSchedules.checklistTemplateId,
      assetId: maintenanceSchedules.assetId,
    })
    .from(maintenanceSchedules)
    .where(isNull(maintenanceSchedules.deletedAt))
    .orderBy(asc(maintenanceSchedules.nextRunAt), asc(maintenanceSchedules.name));

  const DELETED_PAGE_SIZE = 5;
  const deletedSchedules = await db
    .select({
      id: maintenanceSchedules.id,
      name: maintenanceSchedules.name,
      deletedAt: maintenanceSchedules.deletedAt,
    })
    .from(maintenanceSchedules)
    .where(isNotNull(maintenanceSchedules.deletedAt))
    .orderBy(desc(maintenanceSchedules.deletedAt))
    .limit(DELETED_PAGE_SIZE + 1);
  const deletedInitial = deletedSchedules.slice(0, DELETED_PAGE_SIZE);
  const deletedInitialHasMore = deletedSchedules.length > DELETED_PAGE_SIZE;

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

  const scheduleIds = schedules.map((s) => s.id);
  const assigneesBySchedule =
    await loadManyMaintenanceScheduleAssigneeIds(scheduleIds);

  const calendarSchedules = schedules.map((s) => {
    const junction = assigneesBySchedule.get(s.id) ?? [];
    const assigneeIds =
      junction.length > 0 ? junction : s.assigneeId ? [s.assigneeId] : [];
    return {
      id: s.id,
      name: s.name,
      recurrence: s.recurrence,
      color: s.color,
      assigneeIds,
      nextRunAt: s.nextRunAt ? s.nextRunAt.toISOString() : null,
      checklistTemplateId: s.checklistTemplateId ?? null,
      assetId: s.assetId ?? null,
    };
  });

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Calendario</h1>
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

      <CalendarMonthView
        schedules={calendarSchedules}
        assets={assetOptions.map((a) => ({
          id: a.id,
          name: a.name,
          sublabel: a.assetId,
        }))}
        users={userList}
        checklistTemplates={templateOptions}
      />

      <DeletedSchedulesSection
        initial={deletedInitial.map((d) => ({
          id: d.id,
          name: d.name,
          deletedAt: d.deletedAt ? d.deletedAt.toISOString() : null,
        }))}
        initialHasMore={deletedInitialHasMore}
      />
    </div>
  );
}
