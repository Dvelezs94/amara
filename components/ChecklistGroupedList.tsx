import type { ReactNode } from "react";
import {
  groupFlattenedChecklistBySection,
  type ChecklistDisplayGroup,
} from "@/lib/checklist-item-tree";
import { ChecklistSectionShell } from "@/components/ChecklistSectionShell";

type ChecklistRow = {
  id: string;
  type: string;
  label?: string;
  parentItemId?: string | null;
};

export function ChecklistGroupedList<T extends ChecklistRow>({
  flat,
  all,
  renderItem,
  className = "space-y-5",
  looseListClassName = "divide-y divide-zinc-100",
  collapseContextKey,
}: {
  flat: readonly T[];
  all: readonly { id: string; parentItemId?: string | null }[];
  renderItem: (item: T, ctx: { insideSection: boolean }) => ReactNode;
  className?: string;
  looseListClassName?: string;
  /** Remember collapsed sections per checklist view (e.g. work order id). */
  collapseContextKey?: string;
}) {
  const groups = groupFlattenedChecklistBySection(flat, all);
  return (
    <div className={className}>
      {groups.map((group, groupIdx) => (
        <ChecklistGroupBlock
          key={groupKey(group, groupIdx)}
          group={group}
          renderItem={renderItem}
          looseListClassName={looseListClassName}
          collapseContextKey={collapseContextKey}
        />
      ))}
    </div>
  );
}

function groupKey<T extends ChecklistRow>(group: ChecklistDisplayGroup<T>, index: number) {
  if (group.kind === "section") return group.section.id;
  return group.items[0]?.id ?? `loose-${index}`;
}

function ChecklistGroupBlock<T extends ChecklistRow>({
  group,
  renderItem,
  looseListClassName,
  collapseContextKey,
}: {
  group: ChecklistDisplayGroup<T>;
  renderItem: (item: T, ctx: { insideSection: boolean }) => ReactNode;
  looseListClassName: string;
  collapseContextKey?: string;
}) {
  if (group.kind === "loose") {
    if (group.items.length === 0) return null;
    return <ul className={looseListClassName}>{group.items.map((item) => renderItem(item, { insideSection: false }))}</ul>;
  }

  const title = "label" in group.section && typeof group.section.label === "string"
    ? group.section.label
    : "Sección";

  if (group.items.length === 0) {
    return (
      <h3
        key={group.section.id}
        className="px-1 text-base font-semibold tracking-tight text-zinc-900"
      >
        {title}
      </h3>
    );
  }

  return (
    <ChecklistSectionShell
      sectionId={group.section.id}
      title={title}
      collapseContextKey={collapseContextKey}
    >
      <ul className="list-none divide-y divide-zinc-100">
        {group.items.map((item) => renderItem(item, { insideSection: true }))}
      </ul>
    </ChecklistSectionShell>
  );
}
