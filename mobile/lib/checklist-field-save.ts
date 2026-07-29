/**
 * Checklist field save helpers for the mobile app.
 * Keeps PATCH payload shapes consistent and supports draft → value flush before close.
 */

export type ChecklistFieldType =
  | "text"
  | "number"
  | "date"
  | "dropdown"
  | "checkbox"
  | "photo"
  | string
  | null
  | undefined;

export type ChecklistPatchPayload = {
  completed?: boolean;
  value?: unknown;
};

export type ChecklistItemLike = {
  id: string;
  type: string;
  fieldType?: string | null;
  completed?: boolean | null;
  value: unknown;
  isOptional?: boolean | null;
};

/** Parse a number field draft (comma or dot decimals). Empty → null. */
export function parseChecklistNumberDraftValue(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Normalize text draft for persistence. */
export function parseChecklistTextDraftValue(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Build the JSON body for `PATCH /api/work-orders/:id/checklist`.
 * Always includes `itemId`; only defined payload keys are sent.
 */
export function buildChecklistPatchBody(
  itemId: string,
  payload: ChecklistPatchPayload
): { itemId: string; completed?: boolean; value?: unknown } {
  const body: { itemId: string; completed?: boolean; value?: unknown } = { itemId };
  if (payload.completed !== undefined) body.completed = payload.completed;
  if (payload.value !== undefined) body.value = payload.value;
  return body;
}

/** Apply a local optimistic update to one checklist item. */
export function applyChecklistItemLocalUpdate<T extends ChecklistItemLike>(
  items: readonly T[],
  itemId: string,
  payload: ChecklistPatchPayload
): T[] {
  return items.map((i) => {
    if (i.id !== itemId) return i;
    return {
      ...i,
      ...(payload.completed !== undefined ? { completed: payload.completed } : {}),
      ...(payload.value !== undefined ? { value: payload.value } : {}),
    };
  });
}

/**
 * Merge unsaved number/text drafts into checklist items for UI completeness checks.
 * Does not mutate the original items.
 */
export function mergeChecklistDraftsIntoItems<T extends ChecklistItemLike>(
  items: readonly T[],
  numberDrafts: Record<string, string>,
  textDrafts: Record<string, string>
): T[] {
  return items.map((item) => {
    if (item.type !== "custom_field") return item;
    if (item.fieldType === "number" && numberDrafts[item.id] !== undefined) {
      return {
        ...item,
        value: parseChecklistNumberDraftValue(numberDrafts[item.id]!),
      };
    }
    if (
      (item.fieldType == null ||
        item.fieldType === "text" ||
        item.fieldType === "") &&
      textDrafts[item.id] !== undefined
    ) {
      return {
        ...item,
        value: parseChecklistTextDraftValue(textDrafts[item.id]!),
      };
    }
    return item;
  });
}

export type ChecklistDraftFlushOp = {
  itemId: string;
  value: unknown;
};

/** Collect PATCH ops needed to persist pending number + text drafts. */
export function collectChecklistDraftFlushOps(
  numberDrafts: Record<string, string>,
  textDrafts: Record<string, string>
): ChecklistDraftFlushOp[] {
  const ops: ChecklistDraftFlushOp[] = [];
  for (const [itemId, text] of Object.entries(numberDrafts)) {
    ops.push({ itemId, value: parseChecklistNumberDraftValue(text) });
  }
  for (const [itemId, text] of Object.entries(textDrafts)) {
    ops.push({ itemId, value: parseChecklistTextDraftValue(text) });
  }
  return ops;
}

/**
 * Normalize a value for a given field type before sending to the API.
 * Ensures numbers are numbers, photos are URL arrays, etc.
 */
export function normalizeChecklistValueForFieldType(
  fieldType: ChecklistFieldType,
  value: unknown
): unknown {
  if (fieldType === "number") {
    if (value == null || value === "") return null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "string") return parseChecklistNumberDraftValue(value);
    return null;
  }
  if (fieldType === "checkbox") {
    if (value == null) return null;
    if (typeof value === "boolean") return value;
    return null;
  }
  if (fieldType === "photo") {
    if (value == null) return [];
    if (Array.isArray(value)) {
      return value
        .map((v) => (typeof v === "string" ? v.trim() : ""))
        .filter(Boolean);
    }
    if (typeof value === "string" && value.trim()) return [value.trim()];
    return [];
  }
  if (fieldType === "date" || fieldType === "dropdown" || fieldType === "text" || !fieldType) {
    if (value == null) return null;
    if (typeof value === "string") {
      const t = value.trim();
      return t === "" ? null : t;
    }
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    return null;
  }
  return value;
}

/** Build a typed PATCH payload from a field interaction. */
export function buildFieldValuePatch(
  fieldType: ChecklistFieldType,
  value: unknown
): ChecklistPatchPayload {
  return { value: normalizeChecklistValueForFieldType(fieldType, value) };
}

export function buildStepCompletedPatch(completed: boolean): ChecklistPatchPayload {
  return { completed };
}
