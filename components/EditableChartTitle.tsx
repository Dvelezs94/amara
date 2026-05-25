"use client";

export function EditableChartTitle({
  value,
  onChange,
  onCommit,
  className = "mb-2",
}: {
  value: string;
  onChange: (next: string) => void;
  /** Called on blur after edit (e.g. persist to storage or API). */
  onCommit?: (next: string) => void;
  className?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={(e) => onCommit?.(e.target.value)}
      aria-label="Título del gráfico"
      className={[
        className,
        "w-full rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm font-medium text-zinc-700",
        "hover:border-zinc-200 focus:border-zinc-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-500/30",
      ]
        .filter(Boolean)
        .join(" ")}
    />
  );
}
