#!/usr/bin/env node

import path from "node:path";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { execSync } from "node:child_process";

function nowIso() {
  return new Date().toISOString();
}

function id(prefix) {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${rand}`;
}

function resolveDbPath() {
  if (process.env.DATABASE_PATH) {
    return path.resolve(process.cwd(), process.env.DATABASE_PATH);
  }
  if (process.env.DATABASE_URL?.startsWith("file:")) {
    return path.resolve(process.cwd(), process.env.DATABASE_URL.slice(5));
  }
  return path.resolve(process.cwd(), "sqlite.db");
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
      { type: "step", label: "Verificar estado general de aislamiento termico" },
      { type: "step", label: "Comprobar funcionamiento de valvulas y linea de gas" },
      { type: "step", label: "Revisar sensores de temperatura y termocuplas" },
      { type: "custom_field", label: "Temperatura maxima registrada (C)", fieldType: "number" },
      {
        type: "custom_field",
        label: "Estado del quemador",
        fieldType: "dropdown",
        options: ["Operativo", "Con ajuste", "Fuera de servicio"],
      },
      { type: "custom_field", label: "Observaciones del tecnico", fieldType: "text" },
    ],
  },
  {
    name: "Checklist diario de extractor de humos",
    description: "Control diario de flujo, filtros y seguridad del extractor.",
    items: [
      { type: "step", label: "Inspeccionar rejillas y ductos visibles" },
      { type: "step", label: "Verificar ruidos y vibraciones anormales" },
      { type: "custom_field", label: "Nivel de flujo (m3/h)", fieldType: "number" },
      {
        type: "custom_field",
        label: "Estado de filtros",
        fieldType: "dropdown",
        options: ["Limpio", "Saturado", "Requiere cambio"],
      },
      { type: "custom_field", label: "Requiere paro de equipo", fieldType: "checkbox" },
    ],
  },
  {
    name: "Checklist mensual de compresor",
    description: "Mantenimiento mensual de compresor en planta metalmecanica.",
    items: [
      { type: "step", label: "Revisar fugas en lineas y conexiones" },
      { type: "step", label: "Comprobar nivel y estado de aceite" },
      { type: "step", label: "Limpiar o reemplazar filtro de admision" },
      { type: "custom_field", label: "Presion de trabajo (bar)", fieldType: "number" },
      { type: "custom_field", label: "Horas acumuladas de operacion", fieldType: "number" },
      { type: "custom_field", label: "Evidencia fotografica", fieldType: "photo" },
    ],
  },
];

async function run() {
  const dbPath = resolveDbPath();
  let sqlite = new Database(dbPath);

  const usersTableExists = Boolean(
    sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users' LIMIT 1"
      )
      .get()
  );

  if (!usersTableExists) {
    console.log(
      "No se encontro esquema en la base de datos. Ejecutando db:push en modo no interactivo..."
    );
    sqlite.close();
    execSync("npx drizzle-kit push --force", {
      stdio: "inherit",
      cwd: process.cwd(),
    });
    sqlite = new Database(dbPath);
  }

  const userColumns = sqlite
    .prepare("PRAGMA table_info(users)")
    .all()
    .map((col) => col.name);
  const hasUsername = userColumns.includes("username");

  const selectUserByIdentity = hasUsername
    ? sqlite.prepare("SELECT id FROM users WHERE username = ? LIMIT 1")
    : sqlite.prepare("SELECT id FROM users WHERE email = ? LIMIT 1");
  const updateUserById = hasUsername
    ? sqlite.prepare(
        "UPDATE users SET email = ?, name = ?, password_hash = ?, role = ? WHERE id = ?"
      )
    : sqlite.prepare(
        "UPDATE users SET name = ?, password_hash = ?, role = ? WHERE id = ?"
      );

  const insertUser = hasUsername
    ? sqlite.prepare(
        "INSERT INTO users (id, username, email, name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
    : sqlite.prepare(
        "INSERT INTO users (id, email, name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)"
      );

  const selectAssetByAssetId = sqlite.prepare(
    "SELECT id FROM assets WHERE asset_id = ? LIMIT 1"
  );
  const insertAsset = sqlite.prepare(
    "INSERT INTO assets (id, name, asset_id, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
  );

  const selectTemplateByName = sqlite.prepare(
    "SELECT id FROM checklist_templates WHERE name = ? LIMIT 1"
  );
  const insertTemplate = sqlite.prepare(
    "INSERT INTO checklist_templates (id, name, description, created_at) VALUES (?, ?, ?, ?)"
  );
  const countTemplateItems = sqlite.prepare(
    "SELECT COUNT(*) as total FROM checklist_template_items WHERE checklist_template_id = ?"
  );
  const insertTemplateItem = sqlite.prepare(
    "INSERT INTO checklist_template_items (id, checklist_template_id, type, label, sort_order, field_type, options) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  const selectTemplateItems = sqlite.prepare(
    "SELECT type, label, sort_order, field_type, options FROM checklist_template_items WHERE checklist_template_id = ? ORDER BY sort_order ASC"
  );

  const selectAssetByCode = sqlite.prepare(
    "SELECT id, name, asset_id FROM assets WHERE asset_id = ? LIMIT 1"
  );
  const selectWorkOrderByTitle = sqlite.prepare(
    "SELECT id FROM work_orders WHERE title = ? LIMIT 1"
  );
  const insertWorkOrder = sqlite.prepare(
    "INSERT INTO work_orders (id, title, description, status, priority, asset_id, assignee_id, requester_id, due_date, completed_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );
  const countChecklistByWorkOrder = sqlite.prepare(
    "SELECT COUNT(*) as total FROM work_order_checklist WHERE work_order_id = ?"
  );
  const insertWorkOrderChecklistItem = sqlite.prepare(
    "INSERT INTO work_order_checklist (id, work_order_id, checklist_template_id, type, label, sort_order, completed, value, field_type, options) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );

  const tx = sqlite.transaction((passwordHashAdmin, passwordHashOperador) => {
    const createdAt = nowIso();
    const usersToSeed = [
      {
        username: "admin",
        email: "admin@admin.com",
        name: "Administrador Planta",
        role: "admin",
        passwordHash: passwordHashAdmin,
      },
      {
        username: "operador",
        email: "operador@metalnova.local",
        name: "Operador Turno A",
        role: "operator",
        passwordHash: passwordHashOperador,
      },
    ];

    let usersInserted = 0;
    let usersUpdated = 0;
    for (const user of usersToSeed) {
      const existing = selectUserByIdentity.get(
        hasUsername ? user.username : user.email
      );
      if (existing) {
        if (hasUsername) {
          updateUserById.run(
            user.email,
            user.name,
            user.passwordHash,
            user.role,
            existing.id
          );
        } else {
          updateUserById.run(
            user.name,
            user.passwordHash,
            user.role,
            existing.id
          );
        }
        usersUpdated += 1;
        continue;
      }
      if (hasUsername) {
        insertUser.run(
          id("usr"),
          user.username,
          user.email,
          user.name,
          user.passwordHash,
          user.role,
          createdAt
        );
      } else {
        insertUser.run(
          id("usr"),
          user.email,
          user.name,
          user.passwordHash,
          user.role,
          createdAt
        );
      }
      usersInserted += 1;
    }

    let assetsInserted = 0;
    for (const asset of assetSeed) {
      const existing = selectAssetByAssetId.get(asset.assetId);
      if (existing) continue;
      insertAsset.run(
        id("ast"),
        asset.name,
        asset.assetId,
        JSON.stringify(asset.metadata),
        createdAt,
        createdAt
      );
      assetsInserted += 1;
    }

    let templatesInserted = 0;
    let itemsInserted = 0;
    for (const template of checklistSeed) {
      let templateId = null;
      const existing = selectTemplateByName.get(template.name);
      if (existing) {
        templateId = existing.id;
      } else {
        templateId = id("tpl");
        insertTemplate.run(templateId, template.name, template.description, createdAt);
        templatesInserted += 1;
      }

      const existingItemsCount = countTemplateItems.get(templateId)?.total ?? 0;
      if (existingItemsCount > 0) continue;

      template.items.forEach((item, index) => {
        insertTemplateItem.run(
          id("it"),
          templateId,
          item.type,
          item.label,
          index,
          item.fieldType ?? null,
          item.options ? JSON.stringify(item.options) : null
        );
        itemsInserted += 1;
      });
    }

    const adminIdentity = hasUsername ? "admin" : "admin@admin.com";
    const operadorIdentity = hasUsername ? "operador" : "operador@metalnova.local";
    const adminId =
      selectUserByIdentity.get(adminIdentity)?.id ?? null;
    const operadorId =
      selectUserByIdentity.get(operadorIdentity)?.id ?? null;

    const workOrderSeed = [
      {
        title: "Falla de calentamiento en horno HT-01",
        description:
          "El horno no supera los 600C durante el turno nocturno. Revisar quemador y termocupla.",
        status: "pending",
        priority: "urgent",
        assetCode: "HORNO-HT-01",
        templateName: "Checklist semanal de horno industrial",
      },
      {
        title: "Mantenimiento preventivo extractor EX-03",
        description:
          "Inspeccion programada de flujo y estado de filtros en cabina de soldadura.",
        status: "in_progress",
        priority: "high",
        assetCode: "EXTR-03",
        templateName: "Checklist diario de extractor de humos",
      },
      {
        title: "Revision mensual compresor CA-01",
        description:
          "Ejecucion de rutina mensual para validar presion, aceite y fugas de linea.",
        status: "completed",
        priority: "medium",
        assetCode: "COMP-CA-01",
        templateName: "Checklist mensual de compresor",
      },
    ];

    let workOrdersInserted = 0;
    let checklistInstancesInserted = 0;
    for (const workOrder of workOrderSeed) {
      const existing = selectWorkOrderByTitle.get(workOrder.title);
      if (existing) continue;

      const asset = selectAssetByCode.get(workOrder.assetCode);
      const template = selectTemplateByName.get(workOrder.templateName);
      const workOrderId = id("wo");
      const createdAt = nowIso();
      const completedAt =
        workOrder.status === "completed" ? nowIso() : null;

      insertWorkOrder.run(
        workOrderId,
        workOrder.title,
        workOrder.description,
        workOrder.status,
        workOrder.priority,
        asset?.id ?? null,
        operadorId,
        adminId,
        null,
        completedAt,
        createdAt,
        createdAt
      );
      workOrdersInserted += 1;

      if (!template?.id) continue;
      const existingChecklist = countChecklistByWorkOrder.get(workOrderId)?.total ?? 0;
      if (existingChecklist > 0) continue;

      const templateItems = selectTemplateItems.all(template.id);
      for (const item of templateItems) {
        insertWorkOrderChecklistItem.run(
          id("woi"),
          workOrderId,
          template.id,
          item.type,
          item.label,
          item.sort_order,
          workOrder.status === "completed" && item.type === "step" ? 1 : 0,
          null,
          item.field_type ?? null,
          item.options ?? null
        );
        checklistInstancesInserted += 1;
      }
    }

    return {
      usersInserted,
      usersUpdated,
      assetsInserted,
      templatesInserted,
      itemsInserted,
      workOrdersInserted,
      checklistInstancesInserted,
    };
  });

  try {
    const hashAdmin = await bcrypt.hash("1234aA", 10);
    const hashOperador = await bcrypt.hash("operador1234", 10);
    const result = tx(hashAdmin, hashOperador);

    console.log("Seed completado para entorno metalmecanico (espanol).");
    console.log(
      hasUsername
        ? "Modo autenticacion detectado: usuario + contrasena"
        : "Modo autenticacion detectado: correo + contrasena"
    );
    console.log(`Usuarios insertados: ${result.usersInserted}`);
    console.log(`Usuarios actualizados: ${result.usersUpdated}`);
    console.log(`Activos insertados: ${result.assetsInserted}`);
    console.log(`Plantillas insertadas: ${result.templatesInserted}`);
    console.log(`Items de checklist insertados: ${result.itemsInserted}`);
    console.log(`Ordenes de trabajo insertadas: ${result.workOrdersInserted}`);
    console.log(
      `Items de checklist en ordenes insertados: ${result.checklistInstancesInserted}`
    );
    console.log("");
    console.log("Credenciales de prueba:");
    console.log("- admin (admin@admin.com) / 1234aA");
    console.log("- operador / operador1234");
  } finally {
    sqlite.close();
  }
}

run().catch((err) => {
  console.error("Error ejecutando seed:", err);
  process.exit(1);
});
