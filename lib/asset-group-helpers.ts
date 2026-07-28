export type AssetGroupSortRow = {
  id: string;
  name: string;
  sortOrder: number;
};

export type AssetWithGroupId = {
  groupId: string | null;
};

/** Sort groups by sortOrder, then name (es). */
export function sortAssetGroups<T extends AssetGroupSortRow>(groups: T[]): T[] {
  return [...groups].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "es")
  );
}

export type AssetGroupSection<T extends AssetWithGroupId> = {
  groupId: string | null;
  assets: T[];
};

/**
 * Partition assets into flat group sections (ordered groups, then ungrouped).
 * Empty groups are included so the UI can show them.
 */
export function partitionAssetsByGroup<T extends AssetWithGroupId>(
  assets: T[],
  groups: AssetGroupSortRow[]
): AssetGroupSection<T>[] {
  const sorted = sortAssetGroups(groups);
  const byGroup = new Map<string | null, T[]>();
  for (const g of sorted) {
    byGroup.set(g.id, []);
  }
  byGroup.set(null, []);

  for (const asset of assets) {
    const key =
      asset.groupId && byGroup.has(asset.groupId) ? asset.groupId : null;
    byGroup.get(key)!.push(asset);
  }

  const sections: AssetGroupSection<T>[] = sorted.map((g) => ({
    groupId: g.id,
    assets: byGroup.get(g.id) ?? [],
  }));
  sections.push({ groupId: null, assets: byGroup.get(null) ?? [] });
  return sections;
}

/** Keep sections that have assets, or (when not searching) empty named groups. */
export function filterAssetGroupSections<T extends AssetWithGroupId>(
  sections: AssetGroupSection<T>[],
  opts: { searching: boolean }
): AssetGroupSection<T>[] {
  return sections.filter((s) => {
    if (s.assets.length > 0) return true;
    if (opts.searching) return false;
    return s.groupId !== null;
  });
}
