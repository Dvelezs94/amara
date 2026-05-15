import { createId } from "@/lib/id";

export type ChecklistTemplateItemParsed = {
  clientId: string;
  parentClientId: string | null;
  type: "step" | "custom_field" | "text_block" | "section";
  label: string;
  fieldType:
    | "text"
    | "number"
    | "date"
    | "dropdown"
    | "checkbox"
    | "photo"
    | "title"
    | "subtitle"
    | "paragraph"
    | null;
  options: string[] | null;
  /** Solo `custom_field`. */
  isOptional?: boolean;
};

function normalizeType(raw: unknown): ChecklistTemplateItemParsed["type"] {
  if (
    raw === "custom_field" ||
    raw === "text_block" ||
    raw === "section" ||
    raw === "step"
  ) {
    return raw;
  }
  return "step";
}

/**
 * Parse checklist items from API / revision JSON. Assigns stable `clientId` when `id` is missing
 * (legacy snapshots) so parents can still be resolved when `parentItemId` is present.
 */
export function parseChecklistTemplateItemsFromClientJson(
  rawItems: Array<Record<string, unknown>>
): { items: ChecklistTemplateItemParsed[]; error: string | null } {
  const items: ChecklistTemplateItemParsed[] = [];
  for (let i = 0; i < rawItems.length; i += 1) {
    const it = rawItems[i]!;
    const type = normalizeType(it.type);
    const label = String(
      it.label ??
        (type === "custom_field"
          ? "Campo"
          : type === "text_block"
            ? "Texto"
            : type === "section"
              ? "Sección"
              : "Paso")
    ).trim();
    const rawFieldType = typeof it.fieldType === "string" ? it.fieldType : "";
    const fieldType: ChecklistTemplateItemParsed["fieldType"] =
      type === "custom_field"
        ? rawFieldType === "number" ||
          rawFieldType === "date" ||
          rawFieldType === "dropdown" ||
          rawFieldType === "checkbox" ||
          rawFieldType === "photo"
          ? rawFieldType
          : "text"
        : type === "text_block"
          ? rawFieldType === "title" ||
            rawFieldType === "subtitle" ||
            rawFieldType === "paragraph"
            ? rawFieldType
            : "paragraph"
          : null;
    const options: string[] | null =
      type === "custom_field" &&
      fieldType === "dropdown" &&
      Array.isArray(it.options)
        ? (it.options as unknown[]).map((opt) => String(opt))
        : null;

    const isOptional =
      type === "custom_field" &&
      (it.isOptional === true || it.isOptional === "true");

    const rawId = typeof it.id === "string" && it.id.trim() ? it.id.trim() : "";
    const clientId = rawId || `legacy-${i}-${createId()}`;
    const rawParent =
      typeof it.parentItemId === "string" && it.parentItemId.trim()
        ? it.parentItemId.trim()
        : null;
    const parentClientId = rawParent;

    items.push({
      clientId,
      parentClientId,
      type,
      label,
      fieldType,
      options,
      ...(isOptional ? { isOptional: true } : {}),
    });
  }

  const idSet = new Set(items.map((x) => x.clientId));
  if (idSet.size !== items.length) {
    return { items, error: "Los ids de elementos deben ser únicos" };
  }

  const indexById = new Map(items.map((it, idx) => [it.clientId, idx] as const));
  for (const it of items) {
    if (it.type === "section" && it.parentClientId) {
      return { items, error: "Las secciones solo pueden estar en el nivel raíz" };
    }
    if (!it.parentClientId) continue;
    const pIdx = indexById.get(it.parentClientId);
    if (pIdx === undefined) {
      return { items, error: "Referencia de sección padre inválida" };
    }
    const myIdx = indexById.get(it.clientId)!;
    if (pIdx >= myIdx) {
      return { items, error: "La sección debe aparecer antes que sus elementos" };
    }
    const parent = items[pIdx]!;
    if (parent.type !== "section") {
      return { items, error: "Solo una sección puede contener elementos anidados" };
    }
  }

  for (const it of items) {
    const seen = new Set<string>();
    let p: string | null | undefined = it.parentClientId;
    while (p) {
      if (seen.has(p)) {
        return { items, error: "Jerarquía de secciones inválida (ciclo)" };
      }
      seen.add(p);
      const idx = indexById.get(p);
      if (idx === undefined) break;
      p = items[idx]!.parentClientId;
    }
  }

  return { items, error: null };
}

export type ChecklistTemplateItemInsertRow = {
  id: string;
  parentItemId: string | null;
  sortOrder: number;
  type: ChecklistTemplateItemParsed["type"];
  label: string;
  fieldType: ChecklistTemplateItemParsed["fieldType"];
  options: string[] | null;
  isOptional: boolean;
};

/** Map client ids to new DB ids and resolve parent_item_id for inserts. */
export function mapChecklistItemsToInsertRows(
  items: ChecklistTemplateItemParsed[],
  newId: () => string
): ChecklistTemplateItemInsertRow[] {
  const idMap = new Map<string, string>();
  for (const it of items) {
    idMap.set(it.clientId, newId());
  }
  return items.map((it, sortOrder) => ({
    id: idMap.get(it.clientId)!,
    parentItemId: it.parentClientId ? idMap.get(it.parentClientId) ?? null : null,
    sortOrder,
    type: it.type,
    label: it.label,
    fieldType: it.fieldType,
    options: it.options,
    isOptional: it.type === "custom_field" && it.isOptional === true,
  }));
}
