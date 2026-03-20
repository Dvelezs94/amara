"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type UserOption = { id: string; name: string };

export function MaintenanceAssigneeSelect({
  scheduleId,
  users,
  assigneeId,
}: {
  scheduleId: string;
  users: UserOption[];
  assigneeId: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(assigneeId ?? "");
  const [saving, setSaving] = useState(false);

  async function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    setValue(next);
    setSaving(true);
    try {
      await fetch(`/api/maintenance-schedules/${scheduleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assigneeId: next === "" ? null : next,
        }),
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-zinc-500">
        Responsable (opcional)
      </label>
      <select
        value={value}
        disabled={saving}
        onChange={onChange}
        className="w-full max-w-xs rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-60"
      >
        <option value="">Sin asignar</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>
    </div>
  );
}
