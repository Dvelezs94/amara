import { db } from "@/lib/db";
import {
  assets,
  assetFiles,
  workOrders,
  checklistTemplates,
  checklistTemplateItems,
  requests,
} from "@/lib/db/schema";
import { eq, desc, asc, inArray, sql, and } from "drizzle-orm";

export const AI_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "list_assets",
      description: "List all assets (equipment/sites). Use to find asset names and IDs for maintenance questions.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_asset",
      description: "Get one asset by id with its linked documents and work order count.",
      parameters: {
        type: "object",
        properties: {
          asset_id: { type: "string", description: "Asset UUID" },
        },
        required: ["asset_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_work_orders",
      description: "List work orders. Filter by status: open, in_progress, completed, cancelled.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["open", "in_progress", "completed", "cancelled"], description: "Filter by status" },
          limit: { type: "number", description: "Max number to return (default 20)" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_work_order",
      description: "Get one work order by id with title, status, priority, asset, due date, description.",
      parameters: {
        type: "object",
        properties: {
          work_order_id: { type: "string", description: "Work order UUID" },
        },
        required: ["work_order_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_checklist_templates",
      description: "List checklist templates (used for work orders). Each has steps and custom fields.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_checklist_template",
      description: "Get one checklist template with all items (steps and custom fields with types).",
      parameters: {
        type: "object",
        properties: {
          template_id: { type: "string", description: "Checklist template UUID" },
        },
        required: ["template_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_documents",
      description: "List documents in the knowledge base (manuals, specs). Optionally filter by category or asset.",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string", description: "Filter by category (e.g. manual, spec)" },
          asset_id: { type: "string", description: "Filter by asset UUID (only docs linked to this asset)" },
          limit: { type: "number", description: "Max number (default 30)" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_requests",
      description: "List maintenance requests (pending, converted, cancelled).",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["pending", "converted", "cancelled"], description: "Filter by status" },
          limit: { type: "number", description: "Max number (default 20)" },
        },
      },
    },
  },
];

export async function runAiTool(
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  try {
    switch (name) {
      case "list_assets": {
        const list = await db
          .select({ id: assets.id, name: assets.name, assetId: assets.assetId })
          .from(assets)
          .orderBy(assets.name);
        return JSON.stringify(list, null, 2);
      }
      case "get_asset": {
        const assetId = args.asset_id as string;
        const asset = await db.query.assets.findFirst({
          where: eq(assets.id, assetId),
        });
        if (!asset) return JSON.stringify({ error: "Asset not found" });
        const [files, woCount] = await Promise.all([
          db
            .select({ filename: assetFiles.filename, category: assetFiles.category })
            .from(assetFiles)
            .where(eq(assetFiles.assetId, assetId)),
          db
            .select({ count: sql<number>`count(*)` })
            .from(workOrders)
            .where(eq(workOrders.assetId, assetId)),
        ]);
        return JSON.stringify(
          {
            ...asset,
            documents: files,
            workOrderCount: woCount[0]?.count ?? 0,
          },
          null,
          2
        );
      }
      case "list_work_orders": {
        const status = args.status as string | undefined;
        const limit = Math.min(Number(args.limit) || 20, 50);
        const list = await db
          .select({
            id: workOrders.id,
            title: workOrders.title,
            status: workOrders.status,
            priority: workOrders.priority,
            dueDate: workOrders.dueDate,
            assetId: workOrders.assetId,
          })
          .from(workOrders)
          .where(status ? eq(workOrders.status, status) : undefined)
          .orderBy(desc(workOrders.updatedAt))
          .limit(limit);
        const assetIds = [...new Set(list.map((r) => r.assetId).filter(Boolean))] as string[];
        let assetMap = new Map<string, { name: string; assetId: string }>();
        if (assetIds.length > 0) {
          const assetList = await db
            .select({ id: assets.id, name: assets.name, assetId: assets.assetId })
            .from(assets)
            .where(inArray(assets.id, assetIds));
          assetList.forEach((a) => assetMap.set(a.id, { name: a.name, assetId: a.assetId }));
        }
        const withAsset = list.map((wo) => ({
          ...wo,
          assetName: wo.assetId ? assetMap.get(wo.assetId)?.name : null,
        }));
        return JSON.stringify(withAsset, null, 2);
      }
      case "get_work_order": {
        const id = args.work_order_id as string;
        const wo = await db.query.workOrders.findFirst({
          where: eq(workOrders.id, id),
        });
        if (!wo) return JSON.stringify({ error: "Work order not found" });
        const asset = wo.assetId
          ? await db.query.assets.findFirst({
              where: eq(assets.id, wo.assetId),
              columns: { id: true, name: true, assetId: true },
            })
          : null;
        return JSON.stringify({ ...wo, asset }, null, 2);
      }
      case "list_checklist_templates": {
        const list = await db.query.checklistTemplates.findMany({
          columns: { id: true, name: true, description: true },
        });
        const withCount = await Promise.all(
          list.map(async (t) => {
            const items = await db.query.checklistTemplateItems.findMany({
              where: eq(checklistTemplateItems.checklistTemplateId, t.id),
              columns: { id: true },
            });
            return { ...t, itemCount: items.length };
          })
        );
        return JSON.stringify(withCount, null, 2);
      }
      case "get_checklist_template": {
        const templateId = args.template_id as string;
        const template = await db.query.checklistTemplates.findFirst({
          where: eq(checklistTemplates.id, templateId),
        });
        if (!template) return JSON.stringify({ error: "Template not found" });
        const items = await db.query.checklistTemplateItems.findMany({
          where: eq(checklistTemplateItems.checklistTemplateId, templateId),
          orderBy: [asc(checklistTemplateItems.sortOrder)],
        });
        return JSON.stringify({ ...template, items }, null, 2);
      }
      case "list_documents": {
        const category = args.category as string | undefined;
        const assetId = args.asset_id as string | undefined;
        const limit = Math.min(Number(args.limit) || 30, 50);
        const conditions = [];
        if (category) conditions.push(eq(assetFiles.category, category));
        if (assetId) conditions.push(eq(assetFiles.assetId, assetId));
        const all = await db.query.assetFiles.findMany({
          columns: { id: true, filename: true, category: true, assetId: true },
          where: conditions.length > 0 ? and(...conditions) : undefined,
          orderBy: [desc(assetFiles.createdAt)],
          limit,
        });
        const aIds = [...new Set(all.map((f) => f.assetId).filter(Boolean))] as string[];
        let assetMap = new Map<string, { name: string; assetId: string }>();
        if (aIds.length > 0) {
          const al = await db.select({ id: assets.id, name: assets.name, assetId: assets.assetId }).from(assets).where(inArray(assets.id, aIds));
          al.forEach((a) => assetMap.set(a.id, { name: a.name, assetId: a.assetId }));
        }
        const result = all.map((f) => ({
          ...f,
          assetName: f.assetId ? assetMap.get(f.assetId)?.name : "Sin activo",
        }));
        return JSON.stringify(result, null, 2);
      }
      case "list_requests": {
        const status = args.status as string | undefined;
        const limit = Math.min(Number(args.limit) || 20, 50);
        const list = await db
          .select({
            id: requests.id,
            description: requests.description,
            status: requests.status,
            workOrderId: requests.workOrderId,
          })
          .from(requests)
          .where(status ? eq(requests.status, status) : undefined)
          .orderBy(desc(requests.createdAt))
          .limit(limit);
        return JSON.stringify(list, null, 2);
      }
      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (err) {
    return JSON.stringify({
      error: err instanceof Error ? err.message : "Tool execution failed",
    });
  }
}
