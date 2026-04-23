/**
 * Demo seed for PostgreSQL. Run: `npm run db:seed`
 * Requires DATABASE_URL and an existing schema (`npm run db:push`).
 */
import { execSync } from "node:child_process";
import bcrypt from "bcryptjs";
import { eq, asc, count } from "drizzle-orm";
import { db, pool } from "../lib/db";
import * as schema from "../lib/db/schema";

function rid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

async function usersTableExists(): Promise<boolean> {
  const r = await pool.query<{ reg: string | null }>(
    "SELECT to_regclass('public.users') AS reg"
  );
  return r.rows[0]?.reg != null;
}

const assetSeed = [
  {
    name: "Horno de tratamiento termico HT-01",
    assetId: "HORNO-HT-01",
    metadata: { area: "Tratamiento termico", fabricante: "Nabertherm", criticidad: "alta" },
  },
  {
    name: "Extractor de humos EX-03",
    assetId: "EXTR-03",
    metadata: { area: "Soldadura", fabricante: "Soler", criticidad: "alta" },
  },
  {
    name: "Prensa hidraulica 200T PH-02",
    assetId: "PRENSA-200T-02",
    metadata: { area: "Conformado", fabricante: "Hidromec", criticidad: "media" },
  },
  {
    name: "Compresor de aire CA-01",
    assetId: "COMP-CA-01",
    metadata: { area: "Servicios", fabricante: "Atlas Copco", criticidad: "alta" },
  },
  {
    name: "Cortadora laser CL-05",
    assetId: "LASER-CL-05",
    metadata: { area: "Corte", fabricante: "Bystronic", criticidad: "alta" },
  },
  {
    name: "Puente grua PG-02",
    assetId: "GRUA-PG-02",
    metadata: { area: "Logistica interna", fabricante: "Demag", criticidad: "media" },
  },
];

const checklistSeed = [
  {
    name: "Checklist semanal de horno industrial",
    description: "Revision preventiva de seguridad, combustion y limpieza del horno.",
    items: [
      { type: "step" as const, label: "Verificar estado general de aislamiento termico" },
      { type: "step" as const, label: "Comprobar funcionamiento de valvulas y linea de gas" },
      { type: "step" as const, label: "Revisar sensores de temperatura y termocuplas" },
      {
        type: "custom_field" as const,
        label: "Temperatura maxima registrada (C)",
        fieldType: "number" as const,
      },
      {
        type: "custom_field" as const,
        label: "Estado del quemador",
        fieldType: "dropdown" as const,
        options: ["Operativo", "Con ajuste", "Fuera de servicio"],
      },
      { type: "custom_field" as const, label: "Observaciones del tecnico", fieldType: "text" as const },
    ],
  },
  {
    name: "Checklist diario de extractor de humos",
    description: "Control diario de flujo, filtros y seguridad del extractor.",
    items: [
      { type: "step" as const, label: "Verificar arranque y vibraciones del motor" },
      { type: "step" as const, label: "Inspeccion visual de filtros y sellos" },
      { type: "step" as const, label: "Comprobar alarmas y presostatos" },
      { type: "custom_field" as const, label: "Caudal medido (m3/h)", fieldType: "number" as const },
      { type: "custom_field" as const, label: "Evidencia fotografica", fieldType: "photo" as const },
    ],
  },
  {
    name: "Checklist mensual de compresor",
    description: "Mantenimiento mensual de compresor en planta metalmecanica.",
    items: [
      { type: "step" as const, label: "Revisar fugas en lineas y conexiones" },
      { type: "step" as const, label: "Comprobar nivel y estado de aceite" },
      { type: "step" as const, label: "Limpiar o reemplazar filtro de admision" },
      { type: "custom_field" as const, label: "Presion de trabajo (bar)", fieldType: "number" as const },
      { type: "custom_field" as const, label: "Horas acumuladas de operacion", fieldType: "number" as const },
      { type: "custom_field" as const, label: "Evidencia fotografica", fieldType: "photo" as const },
    ],
  },
];

async function main() {
  if (!(await usersTableExists())) {
    console.log("No users table. Running: npx drizzle-kit push --force");
    execSync("npx drizzle-kit push --force", { stdio: "inherit", cwd: process.cwd() });
  }

  const hashAdmin = await bcrypt.hash("1234aA", 10);
  const hashOperador = await bcrypt.hash("operador1234", 10);

  let usersInserted = 0;
  let usersUpdated = 0;
  let assetsInserted = 0;
  let templatesInserted = 0;
  let itemsInserted = 0;
  let workOrdersInserted = 0;
  let checklistInstancesInserted = 0;

  await db.transaction(async (tx) => {
    const usersToSeed = [
      {
        username: "admin",
        email: "admin@admin.com",
        name: "Administrador Planta",
        role: "admin" as const,
        passwordHash: hashAdmin,
      },
      {
        username: "operador",
        email: "operador@metalnova.local",
        name: "Operador Turno A",
        role: "operator" as const,
        passwordHash: hashOperador,
      },
    ];

    for (const u of usersToSeed) {
      const existing = await tx
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.username, u.username))
        .limit(1);
      if (existing[0]) {
        await tx
          .update(schema.users)
          .set({
            email: u.email,
            name: u.name,
            passwordHash: u.passwordHash,
            role: u.role,
          })
          .where(eq(schema.users.id, existing[0].id));
        usersUpdated += 1;
      } else {
        await tx.insert(schema.users).values({
          id: rid("usr"),
          username: u.username,
          email: u.email,
          name: u.name,
          passwordHash: u.passwordHash,
          role: u.role,
        });
        usersInserted += 1;
      }
    }

    for (const asset of assetSeed) {
      const existing = await tx
        .select({ id: schema.assets.id })
        .from(schema.assets)
        .where(eq(schema.assets.assetId, asset.assetId))
        .limit(1);
      if (existing.length) continue;
      await tx.insert(schema.assets).values({
        id: rid("ast"),
        name: asset.name,
        assetId: asset.assetId,
        metadata: asset.metadata,
      });
      assetsInserted += 1;
    }

    for (const template of checklistSeed) {
      let templateId: string | null = null;
      const existingTpl = await tx
        .select({ id: schema.checklistTemplates.id })
        .from(schema.checklistTemplates)
        .where(eq(schema.checklistTemplates.name, template.name))
        .limit(1);
      if (existingTpl[0]) {
        templateId = existingTpl[0].id;
      } else {
        templateId = rid("tpl");
        await tx.insert(schema.checklistTemplates).values({
          id: templateId,
          name: template.name,
          description: template.description,
        });
        templatesInserted += 1;
      }

      const [row] = await tx
        .select({ c: count() })
        .from(schema.checklistTemplateItems)
        .where(eq(schema.checklistTemplateItems.checklistTemplateId, templateId));
      if (Number(row?.c ?? 0) > 0) continue;

      for (let index = 0; index < template.items.length; index += 1) {
        const item = template.items[index]!;
        await tx.insert(schema.checklistTemplateItems).values({
          id: rid("it"),
          checklistTemplateId: templateId,
          type: item.type,
          label: item.label,
          sortOrder: index,
          fieldType: "fieldType" in item ? item.fieldType : undefined,
          options: "options" in item ? item.options : undefined,
        });
        itemsInserted += 1;
      }
    }

    const [adminRow] = await tx
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.username, "admin"))
      .limit(1);
    const [operadorRow] = await tx
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.username, "operador"))
      .limit(1);
    const adminId = adminRow?.id ?? null;
    const operadorId = operadorRow?.id ?? null;
    if (!adminId || !operadorId) {
      throw new Error("No se encontraron usuarios admin/operador tras el upsert.");
    }

    const workOrderSeed = [
      {
        title: "Falla de calentamiento en horno HT-01",
        description:
          "El horno no supera los 600C durante el turno nocturno. Revisar quemador y termocupla.",
        status: "pending" as const,
        priority: "urgent" as const,
        assetCode: "HORNO-HT-01",
        templateName: "Checklist semanal de horno industrial",
      },
      {
        title: "Mantenimiento preventivo extractor EX-03",
        description:
          "Inspeccion programada de flujo y estado de filtros en cabina de soldadura.",
        status: "in_progress" as const,
        priority: "high" as const,
        assetCode: "EXTR-03",
        templateName: "Checklist diario de extractor de humos",
      },
      {
        title: "Revision mensual compresor CA-01",
        description:
          "Ejecucion de rutina mensual para validar presion, aceite y fugas de linea.",
        status: "completed" as const,
        priority: "medium" as const,
        assetCode: "COMP-CA-01",
        templateName: "Checklist mensual de compresor",
      },
    ];

    for (const workOrder of workOrderSeed) {
      const existingWo = await tx
        .select({ id: schema.workOrders.id })
        .from(schema.workOrders)
        .where(eq(schema.workOrders.title, workOrder.title))
        .limit(1);
      if (existingWo.length) continue;

      const [asset] = await tx
        .select({ id: schema.assets.id })
        .from(schema.assets)
        .where(eq(schema.assets.assetId, workOrder.assetCode))
        .limit(1);
      const [tpl] = await tx
        .select({ id: schema.checklistTemplates.id })
        .from(schema.checklistTemplates)
        .where(eq(schema.checklistTemplates.name, workOrder.templateName))
        .limit(1);

      const workOrderId = rid("wo");
      const createdAt = new Date();
      const completedAt =
        workOrder.status === "completed" ? new Date() : null;

      await tx.insert(schema.workOrders).values({
        id: workOrderId,
        title: workOrder.title,
        description: workOrder.description,
        status: workOrder.status,
        priority: workOrder.priority,
        assetId: asset?.id ?? null,
        assigneeId: operadorId,
        requesterId: adminId,
        dueDate: null,
        completedAt,
        createdAt,
        updatedAt: createdAt,
      });
      workOrdersInserted += 1;

      if (!tpl?.id) continue;

      const templateItems = await tx
        .select()
        .from(schema.checklistTemplateItems)
        .where(eq(schema.checklistTemplateItems.checklistTemplateId, tpl.id))
        .orderBy(asc(schema.checklistTemplateItems.sortOrder));

      for (const item of templateItems) {
        await tx.insert(schema.workOrderChecklist).values({
          id: rid("woi"),
          workOrderId,
          checklistTemplateId: tpl.id,
          type: item.type,
          label: item.label,
          sortOrder: item.sortOrder,
          completed:
            workOrder.status === "completed" && item.type === "step",
          value: null,
          fieldType: item.fieldType ?? undefined,
          options: item.options ?? undefined,
        });
        checklistInstancesInserted += 1;
      }
    }
  });

  console.log("Seed completado para entorno metalmecanico (espanol).");
  console.log(`Usuarios insertados: ${usersInserted}`);
  console.log(`Usuarios actualizados: ${usersUpdated}`);
  console.log(`Activos insertados: ${assetsInserted}`);
  console.log(`Plantillas insertadas: ${templatesInserted}`);
  console.log(`Items de checklist insertados: ${itemsInserted}`);
  console.log(`Ordenes de trabajo insertadas: ${workOrdersInserted}`);
  console.log(
    `Items de checklist en ordenes insertados: ${checklistInstancesInserted}`
  );
  console.log("");
  console.log("Credenciales de prueba:");
  console.log("- admin (admin@admin.com) / 1234aA");
  console.log("- operador / operador1234");
}

main()
  .catch((err) => {
    console.error("Error ejecutando seed:", err);
    process.exit(1);
  })
  .finally(() => {
    void pool.end();
  });
