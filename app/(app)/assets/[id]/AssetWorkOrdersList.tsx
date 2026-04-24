"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, ChevronsUp, Equal } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";

const PAGE_SIZE = 5;

type WorkOrderItem = {
  id: string;
  title: string;
  status: string;
  dueDate: string | Date | null;
  priority?: string | null;
  assigneeId?: string | null;
  assigneeAvatarUrl?: string | null;
  assigneeName?: string | null;
  createdAt: string | Date;
};

function priorityLabel(priority?: string | null) {
  if (priority === "low") return "Baja";
  if (priority === "medium") return "Media";
  if (priority === "high") return "Alta";
  if (priority === "urgent") return "Urgente";
  return "Media";
}

function priorityIconMeta(priority?: string | null) {
  if (priority === "low") return { Icon: ChevronDown, className: "text-[#0065FF]" };
  if (priority === "high") return { Icon: ChevronUp, className: "text-[#FF8B00]" };
  if (priority === "urgent") return { Icon: ChevronsUp, className: "text-[#BF2600]" };
  return { Icon: Equal, className: "text-[#E2A100]" };
}

export function AssetWorkOrdersList({ workOrders }: { workOrders: WorkOrderItem[] }) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const visible = workOrders.slice(0, visibleCount);
  const hasMore = visibleCount < workOrders.length;

  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {visible.map((wo) => (
          <li key={wo.id}>
            <Link
              href={`/tareas/${wo.id}`}
              className="block rounded-lg border border-zinc-200 bg-white p-3 hover:border-primary-200"
            >
              <div className="space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 flex-1 font-medium text-zinc-900">{wo.title}</p>
                  {(() => {
                    const { Icon, className } = priorityIconMeta(wo.priority);
                    return (
                      <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-zinc-900">
                        <Icon className={`h-4 w-4 ${className}`} strokeWidth={2.5} aria-hidden />
                        {priorityLabel(wo.priority)}
                      </span>
                    );
                  })()}
                </div>
                <span
                  className="block text-xs text-zinc-500"
                >
                  {wo.status === "pending"
                    ? "Pendiente"
                    : wo.status === "in_progress"
                      ? "En progreso"
                      : wo.status === "completed"
                        ? "Completada"
                        : wo.status}{" "}
                  · Vence {wo.dueDate ? new Date(wo.dueDate).toLocaleDateString("es") : "—"}
                </span>
                {wo.assigneeName ? (
                  <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                    <span>Asignado:</span>
                    <UserAvatar
                      userId={wo.assigneeId ?? ""}
                      name={wo.assigneeName}
                      avatarUrl={wo.assigneeAvatarUrl}
                      size="sm"
                      className="!h-5 !w-5 !text-[8px]"
                    />
                    <span className="truncate">{wo.assigneeName}</span>
                  </div>
                ) : null}
              </div>
            </Link>
          </li>
        ))}
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
