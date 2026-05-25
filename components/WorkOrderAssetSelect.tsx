"use client";

export type WorkOrderAssetOption = {
  id: string;
  name: string;
  assetId: string;
  tracksMachineDowntime?: boolean;
};

const selectClassName =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-60";

export function WorkOrderAssetSelect({
  value,
  onChange,
  assets,
  disabled,
  loading,
  id = "wo-asset",
}: {
  value: string | null;
  onChange: (assetId: string | null) => void;
  assets: WorkOrderAssetOption[];
  disabled?: boolean;
  loading?: boolean;
  id?: string;
}) {
  return (
    <select
      id={id}
      value={value ?? ""}
      disabled={disabled || loading}
      onChange={(e) => onChange(e.target.value.trim() ? e.target.value : null)}
      className={selectClassName}
      aria-label="Máquina"
    >
      <option value="">Sin máquina</option>
      {assets.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name} ({a.assetId})
        </option>
      ))}
    </select>
  );
}
