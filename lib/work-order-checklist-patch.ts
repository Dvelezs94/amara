/**
 * Parse / normalize work-order checklist PATCH bodies (shared by API route + tests).
 */

export type WorkOrderChecklistPatchParseResult =
  | {
      ok: true;
      itemId: string;
      updates: { completed?: boolean; value?: unknown };
    }
  | { ok: false; error: string; status: number };

export type ChecklistRowForPatch = {
  type: string;
  fieldType?: string | null;
};

function parseChecklistNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const n = Number(value.trim().replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function normalizePhotoValue(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === "string" ? v.trim() : ""))
      .filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

/**
 * Normalize `value` according to the checklist row's field type so jsonb stores
 * the canonical shape (number as number, photo as string[], etc.).
 */
export function normalizeChecklistPatchValue(
  fieldType: string | null | undefined,
  value: unknown
): unknown {
  if (fieldType === "number") {
    return parseChecklistNumber(value);
  }
  if (fieldType === "checkbox") {
    if (value == null) return null;
    if (typeof value === "boolean") return value;
    return null;
  }
  if (fieldType === "photo") {
    return normalizePhotoValue(value);
  }
  if (
    fieldType === "text" ||
    fieldType === "date" ||
    fieldType === "dropdown" ||
    fieldType == null ||
    fieldType === ""
  ) {
    if (value == null) return null;
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed === "" ? null : trimmed;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    return null;
  }
  return value;
}

/**
 * Validate a PATCH body for `/api/work-orders/[id]/checklist`.
 * When `row` is provided, `value` is normalized to the field type.
 */
export function parseWorkOrderChecklistPatchBody(
  body: unknown,
  row?: ChecklistRowForPatch | null
): WorkOrderChecklistPatchParseResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Invalid body", status: 400 };
  }
  const raw = body as Record<string, unknown>;
  const itemId =
    typeof raw.itemId === "string" && raw.itemId.trim() ? raw.itemId.trim() : "";
  if (!itemId) {
    return { ok: false, error: "itemId required", status: 400 };
  }

  const updates: { completed?: boolean; value?: unknown } = {};
  if (raw.completed !== undefined) {
    if (typeof raw.completed !== "boolean") {
      return { ok: false, error: "completed must be boolean", status: 400 };
    }
    updates.completed = raw.completed;
  }
  if (raw.value !== undefined) {
    if (row && (row.type === "section" || row.type === "text_block")) {
      // Callers may no-op these; still accept without writing.
      updates.value = raw.value;
    } else if (row) {
      updates.value = normalizeChecklistPatchValue(row.fieldType, raw.value);
    } else {
      updates.value = raw.value;
    }
  }

  if (updates.completed === undefined && updates.value === undefined) {
    return { ok: false, error: "No updates", status: 400 };
  }

  return { ok: true, itemId, updates };
}
