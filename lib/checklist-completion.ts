/**
 * Work-order checklist rules for closing a task (aligned with API PATCH completion
 * and mobile `isChecklistFullyComplete`).
 */

export type ChecklistCompletionItem = {
  type: string;
  completed?: boolean | null;
  fieldType?: string | null;
  value: unknown;
  /** When true, custom_field may be left blank if valid. */
  isOptional?: boolean | null;
};

function countChecklistPhotoUrls(value: unknown): number {
  const urls = new Set<string>();
  const visit = (input: unknown): void => {
    if (Array.isArray(input)) {
      input.forEach(visit);
      return;
    }
    if (typeof input === "string") {
      const raw = input.trim();
      if (!raw) return;
      if (
        (raw.startsWith("[") && raw.endsWith("]")) ||
        (raw.startsWith("{") && raw.endsWith("}"))
      ) {
        try {
          visit(JSON.parse(raw));
          return;
        } catch {
          urls.add(raw);
          return;
        }
      }
      urls.add(raw);
      return;
    }
    if (input && typeof input === "object") {
      const obj = input as Record<string, unknown>;
      visit(obj.fileUrl);
      visit(obj.url);
      visit(obj.src);
      visit(obj.value);
      visit(obj.values);
      visit(obj.photos);
      visit(obj.attachments);
    }
  };
  visit(value);
  return urls.size;
}

function isEmptyNonCheckboxValue(fieldType: string | null | undefined, value: unknown): boolean {
  if (fieldType === "photo") {
    return countChecklistPhotoUrls(value) === 0;
  }
  if (fieldType === "checkbox") {
    return false;
  }
  if (fieldType === "number") {
    return value == null;
  }
  if (value == null) return true;
  if (typeof value === "number") return false;
  return String(value).trim() === "";
}

function hasInvalidNonEmptyValue(fieldType: string | null | undefined, value: unknown): boolean {
  if (fieldType === "number" && typeof value === "number" && Number.isNaN(value)) {
    return true;
  }
  return false;
}

/**
 * Returns true if this row prevents completing the work order.
 */
export function checklistItemBlocksWorkOrderCompletion(item: ChecklistCompletionItem): boolean {
  if (item.type === "step") {
    return item.completed !== true;
  }
  if (item.type !== "custom_field") {
    return false;
  }

  const optional = item.isOptional === true;
  const ft = item.fieldType;

  if (ft === "checkbox") {
    if (optional) {
      if (item.value == null) return false;
      return typeof item.value !== "boolean";
    }
    return typeof item.value !== "boolean";
  }

  if (optional) {
    if (isEmptyNonCheckboxValue(ft ?? null, item.value)) {
      return false;
    }
    return hasInvalidNonEmptyValue(ft, item.value);
  }

  if (ft === "checkbox") {
    return typeof item.value !== "boolean";
  }
  if (isEmptyNonCheckboxValue(ft ?? null, item.value)) {
    return true;
  }
  if (hasInvalidNonEmptyValue(ft, item.value)) {
    return true;
  }
  return false;
}

export function workOrderChecklistIsCompleteForClosure(
  items: readonly ChecklistCompletionItem[]
): boolean {
  return !items.some(checklistItemBlocksWorkOrderCompletion);
}
