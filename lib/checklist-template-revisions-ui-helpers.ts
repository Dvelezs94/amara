export type ChecklistItemInitial = {
  id?: string;
  parentItemId?: string | null;
  type: string;
  label: string;
  fieldType?: string | null;
  options?: string[] | null | unknown;
  isOptional?: boolean;
};

export type ChecklistInitial = {
  name: string;
  description?: string | null;
  items?: ChecklistItemInitial[];
};

export function normalizeSnapshotItems(
  items: unknown,
  fallbackItems: ChecklistItemInitial[] = []
): ChecklistItemInitial[] {
  if (!Array.isArray(items)) return fallbackItems;
  return items.map((item) => {
    const source = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    return {
      type: String(source.type ?? "custom_field"),
      label: String(source.label ?? ""),
      fieldType: source.fieldType ? String(source.fieldType) : null,
      options: Array.isArray(source.options)
        ? source.options.map((opt) => String(opt))
        : null,
      ...(typeof source.id === "string" && source.id.trim()
        ? { id: source.id.trim() }
        : {}),
      parentItemId:
        typeof source.parentItemId === "string" && source.parentItemId.trim()
          ? source.parentItemId.trim()
          : null,
      ...(source.isOptional === true ? { isOptional: true } : {}),
    };
  });
}

export function buildInitialForDraft(
  draftAfter: unknown,
  template: ChecklistInitial
): ChecklistInitial {
  if (Array.isArray(draftAfter)) {
    return {
      name: template.name,
      description: template.description ?? null,
      items: normalizeSnapshotItems(draftAfter, template.items),
    };
  }

  if (!draftAfter || typeof draftAfter !== "object") return template;
  const after = draftAfter as Record<string, unknown>;
  return {
    name: typeof after.name === "string" ? after.name : template.name,
    description:
      typeof after.description === "string" || after.description === null
        ? (after.description as string | null)
        : template.description ?? null,
    items: normalizeSnapshotItems(after.items, template.items),
  };
}
