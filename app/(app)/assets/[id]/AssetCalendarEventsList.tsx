"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import {
  formatRecurrenceLabel,
  resolveNextMaintenanceDisplayDate,
} from "@/lib/maintenance-recurrence";
import { APP_TIME_ZONE } from "@/lib/timezone";

const PAGE_SIZE = 5;

export type AssetCalendarEventItem = {
  id: string;
  name: string;
  recurrence: string;
  nextRunAt: string | Date | null;
  color: string | null;
  calendarName: string | null;
};

export function AssetCalendarEventsList({
  events,
}: {
  events: AssetCalendarEventItem[];
}) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const visible = events.slice(0, visibleCount);
  const hasMore = visibleCount < events.length;

  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {visible.map((ev) => {
          const next = resolveNextMaintenanceDisplayDate(
            ev.recurrence,
            ev.nextRunAt ? new Date(ev.nextRunAt) : null,
            new Date()
          );
          return (
            <li key={ev.id}>
              <Link
                href="/calendario"
                className="block rounded-lg border border-zinc-200 bg-white p-3 hover:border-primary-200"
              >
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: ev.color ?? "#02257D" }}
                        aria-hidden
                      />
                      <p className="min-w-0 flex-1 font-medium text-zinc-900">
                        {ev.name}
                      </p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary-700">
                      Ver
                      <ExternalLink className="h-3 w-3" aria-hidden />
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500">
                    {formatRecurrenceLabel(ev.recurrence)}
                    {next
                      ? ` · Próximo ${next.toLocaleDateString("es-MX", {
                          timeZone: APP_TIME_ZONE,
                        })}`
                      : ""}
                  </p>
                  {ev.calendarName ? (
                    <p className="text-xs text-zinc-500">
                      Calendario: {ev.calendarName}
                    </p>
                  ) : null}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      {hasMore && (
        <button
          type="button"
          onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Cargar 5 más
        </button>
      )}
    </div>
  );
}
