/**
 * Seed script: run with `npx tsx scripts/seed.ts`
 * Creates demo users and rich sample data if DB is empty.
 */
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import bcrypt from "bcryptjs";
import { join } from "path";
import * as schema from "../lib/db/schema";
import { getNextWorkOrderFolio } from "../lib/work-order-folio";

const dbPath = process.env.DATABASE_PATH ?? join(process.cwd(), "sqlite.db");
const sqlite = new Database(dbPath);
const db = drizzle(sqlite, { schema });

async function seed() {
  const existing = await db.select().from(schema.users).limit(1);
  if (existing.length > 0) {
    console.log("DB already has users, skipping seed.");
    return;
  }

  const adminId = crypto.randomUUID();
  const techAId = crypto.randomUUID();
  const techBId = crypto.randomUUID();
  const passwordHash = await bcrypt.hash("demo1234", 10);

  await db.insert(schema.users).values([
    {
      id: adminId,
      username: "admin",
      email: "admin@amimaint.local",
      name: "Administrador Demo",
      passwordHash,
      role: "admin",
    },
    {
      id: techAId,
      username: "tecnico1",
      email: "tecnico1@amimaint.local",
      name: "Tecnico Uno",
      passwordHash,
      role: "operator",
    },
    {
      id: techBId,
      username: "tecnico2",
      email: "tecnico2@amimaint.local",
      name: "Tecnico Dos",
      passwordHash,
      role: "operator",
    },
  ]);
  console.log("Created demo users: admin/tecnico1/tecnico2 (password: demo1234)");

  const assetId = crypto.randomUUID();
  await db.insert(schema.assets).values({
    id: assetId,
    name: "Horno HT-01",
    assetId: "HT-01",
    locationId: "PLANTA-A",
  });

  const templateId = crypto.randomUUID();
  await db.insert(schema.checklistTemplates).values({
    id: templateId,
    name: "Inspeccion termica",
    description: "Checklist para monitoreo de temperatura en horno industrial",
  });

  const itemStepA = crypto.randomUUID();
  const itemStepB = crypto.randomUUID();
  const itemTemp = crypto.randomUUID();
  const itemPressure = crypto.randomUUID();

  await db.insert(schema.checklistTemplateItems).values([
    {
      id: itemStepA,
      checklistTemplateId: templateId,
      type: "step",
      label: "Verificar estado general del horno",
      sortOrder: 1,
    },
    {
      id: itemStepB,
      checklistTemplateId: templateId,
      type: "step",
      label: "Confirmar sistema de enfriamiento",
      sortOrder: 2,
    },
    {
      id: itemTemp,
      checklistTemplateId: templateId,
      type: "custom_field",
      label: "Temperatura",
      sortOrder: 3,
      fieldType: "number",
    },
    {
      id: itemPressure,
      checklistTemplateId: templateId,
      type: "custom_field",
      label: "Presion",
      sortOrder: 4,
      fieldType: "number",
    },
  ]);

  const now = Date.now();
  const totalOrders = 48;
  for (let i = 0; i < totalOrders; i += 1) {
    const woId = crypto.randomUUID();
    const completedAt = new Date(now - (totalOrders - i) * 12 * 60 * 60 * 1000);
    const createdAt = new Date(completedAt.getTime() - 2 * 60 * 60 * 1000);
    const folio = await getNextWorkOrderFolio();
    const assigneeId = i % 2 === 0 ? techAId : techBId;

    await db.insert(schema.workOrders).values({
      id: woId,
      folio,
      title: `Mantenimiento termico ${String(i + 1).padStart(2, "0")}`,
      description: "Orden de mantenimiento preventiva sembrada para analiticas.",
      status: "completed",
      priority: i % 10 === 0 ? "high" : "medium",
      assetId,
      assigneeId,
      requesterId: adminId,
      dueDate: completedAt,
      completedAt,
      createdAt,
      updatedAt: completedAt,
    });

    const tempValue = 145 + (i % 12) * 3 + (i % 5);
    const pressureValue = 90 + (i % 8) * 2;

    await db.insert(schema.workOrderChecklist).values([
      {
        id: crypto.randomUUID(),
        workOrderId: woId,
        checklistTemplateId: templateId,
        type: "step",
        label: "Verificar estado general del horno",
        sortOrder: 1,
        completed: true,
      },
      {
        id: crypto.randomUUID(),
        workOrderId: woId,
        checklistTemplateId: templateId,
        type: "step",
        label: "Confirmar sistema de enfriamiento",
        sortOrder: 2,
        completed: true,
      },
      {
        id: crypto.randomUUID(),
        workOrderId: woId,
        checklistTemplateId: templateId,
        type: "custom_field",
        label: "Temperatura",
        sortOrder: 3,
        completed: true,
        fieldType: "number",
        value: tempValue,
      },
      {
        id: crypto.randomUUID(),
        workOrderId: woId,
        checklistTemplateId: templateId,
        type: "custom_field",
        label: "Presion",
        sortOrder: 4,
        completed: true,
        fieldType: "number",
        value: pressureValue,
      },
    ]);
  }

  console.log(`Seeded ${totalOrders} completed maintenance orders with checklist data.`);
}

seed().catch(console.error).finally(() => sqlite.close());
