import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  maintenanceScheduleAssignees,
  maintenanceSchedules,
  users,
  workOrderAssignees,
  workOrders,
} from "@/lib/db/schema";
import { dedupeAssigneeIds } from "@/lib/assignee-ids";

export type AssigneeUser = {
  id: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  avatarBackgroundColor: string | null;
};

export async function setWorkOrderAssigneeIds(
  workOrderId: string,
  userIds: string[]
): Promise<void> {
  const unique = dedupeAssigneeIds(userIds);
  await db
    .delete(workOrderAssignees)
    .where(eq(workOrderAssignees.workOrderId, workOrderId));
  if (unique.length > 0) {
    await db.insert(workOrderAssignees).values(
      unique.map((userId) => ({ workOrderId, userId }))
    );
  }
  await db
    .update(workOrders)
    .set({
      assigneeId: unique[0] ?? null,
      updatedAt: new Date(),
    })
    .where(eq(workOrders.id, workOrderId));
}

export async function setMaintenanceScheduleAssigneeIds(
  scheduleId: string,
  userIds: string[]
): Promise<void> {
  const unique = dedupeAssigneeIds(userIds);
  await db
    .delete(maintenanceScheduleAssignees)
    .where(
      eq(maintenanceScheduleAssignees.maintenanceScheduleId, scheduleId)
    );
  if (unique.length > 0) {
    await db.insert(maintenanceScheduleAssignees).values(
      unique.map((userId) => ({
        maintenanceScheduleId: scheduleId,
        userId,
      }))
    );
  }
  await db
    .update(maintenanceSchedules)
    .set({ assigneeId: unique[0] ?? null })
    .where(eq(maintenanceSchedules.id, scheduleId));
}

export async function loadWorkOrderAssignees(
  workOrderId: string,
  legacyAssigneeId: string | null
): Promise<AssigneeUser[]> {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      avatarUrl: users.avatarUrl,
      avatarBackgroundColor: users.avatarBackgroundColor,
    })
    .from(workOrderAssignees)
    .innerJoin(users, eq(workOrderAssignees.userId, users.id))
    .where(eq(workOrderAssignees.workOrderId, workOrderId))
    .orderBy(users.name);
  if (rows.length > 0) return rows;
  if (legacyAssigneeId) {
    const one = await db.query.users.findFirst({
      where: eq(users.id, legacyAssigneeId),
      columns: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        avatarBackgroundColor: true,
      },
    });
    return one ? [one] : [];
  }
  return [];
}

export async function loadManyWorkOrderAssignees(
  workOrderIds: string[]
): Promise<Map<string, AssigneeUser[]>> {
  const map = new Map<string, AssigneeUser[]>();
  if (workOrderIds.length === 0) return map;
  const rows = await db
    .select({
      workOrderId: workOrderAssignees.workOrderId,
      id: users.id,
      name: users.name,
      email: users.email,
      avatarUrl: users.avatarUrl,
      avatarBackgroundColor: users.avatarBackgroundColor,
    })
    .from(workOrderAssignees)
    .innerJoin(users, eq(workOrderAssignees.userId, users.id))
    .where(inArray(workOrderAssignees.workOrderId, workOrderIds))
    .orderBy(users.name);
  for (const r of rows) {
    const list = map.get(r.workOrderId) ?? [];
    list.push({
      id: r.id,
      name: r.name,
      email: r.email,
      avatarUrl: r.avatarUrl,
      avatarBackgroundColor: r.avatarBackgroundColor,
    });
    map.set(r.workOrderId, list);
  }
  return map;
}

export async function loadMaintenanceScheduleAssigneeIds(
  scheduleId: string,
  legacyAssigneeId: string | null
): Promise<string[]> {
  const rows = await db
    .select({ userId: maintenanceScheduleAssignees.userId })
    .from(maintenanceScheduleAssignees)
    .where(
      eq(maintenanceScheduleAssignees.maintenanceScheduleId, scheduleId)
    );
  const ids = rows.map((r) => r.userId);
  if (ids.length > 0) return ids;
  return legacyAssigneeId ? [legacyAssigneeId] : [];
}

export async function loadManyMaintenanceScheduleAssigneeIds(
  scheduleIds: string[]
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (scheduleIds.length === 0) return map;
  const rows = await db
    .select({
      maintenanceScheduleId:
        maintenanceScheduleAssignees.maintenanceScheduleId,
      userId: maintenanceScheduleAssignees.userId,
    })
    .from(maintenanceScheduleAssignees)
    .where(
      inArray(maintenanceScheduleAssignees.maintenanceScheduleId, scheduleIds)
    );
  for (const r of rows) {
    const list = map.get(r.maintenanceScheduleId) ?? [];
    list.push(r.userId);
    map.set(r.maintenanceScheduleId, list);
  }
  return map;
}
