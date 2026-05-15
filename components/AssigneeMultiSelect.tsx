"use client";

/**
 * Accessible multi-select for users (calendar + tareas). Touch-friendly min height on rows.
 */
export function AssigneeMultiSelect({
  id,
  users,
  value,
  onChange,
  disabled,
  label = "Responsables",
  emptyHint = "Nadie seleccionado",
}: {
  id?: string;
  users: { id: string; name: string }[];
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  label?: string;
  emptyHint?: string;
}) {
  const set = new Set(value);

  function toggle(uid: string) {
    if (disabled) return;
    const next = new Set(value);
    if (next.has(uid)) next.delete(uid);
    else next.add(uid);
    onChange(Array.from(next));
  }

  return (
    <div className="min-h-0 space-y-1.5">
      {label ? (
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
          {label}
        </p>
      ) : null}
      {/* Outer clips height inside flex/modal ancestors; inner is the actual scrollport (see min-h-0). */}
      <div className="flex max-h-[min(240px,min(45vh,50dvh))] flex-col overflow-hidden rounded-lg border border-zinc-300 bg-white sm:max-h-56">
        <div
          id={id}
          role="group"
          aria-label={label || "Responsables"}
          className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-1 py-1 touch-pan-y [-webkit-overflow-scrolling:touch] [scrollbar-gutter:stable]"
        >
          {users.length === 0 ? (
            <p className="px-2 py-3 text-xs text-zinc-500">{emptyHint}</p>
          ) : (
            users.map((u) => {
              const checked = set.has(u.id);
              return (
                <label
                  key={u.id}
                  className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm text-zinc-900 transition sm:min-h-0 sm:py-1.5 ${
                    checked ? "bg-primary-50" : "hover:bg-zinc-50"
                  } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0 rounded border-zinc-300 accent-primary-600"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggle(u.id)}
                    aria-checked={checked}
                  />
                  <span className="min-w-0 flex-1">{u.name}</span>
                </label>
              );
            })
          )}
        </div>
      </div>
      {value.length === 0 ? (
        <p className="text-[11px] text-zinc-500">{emptyHint}</p>
      ) : null}
    </div>
  );
}
