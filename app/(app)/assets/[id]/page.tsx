import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { assets } from "@/lib/db/schema";
import { workOrders } from "@/lib/db/schema";
import { assetFiles } from "@/lib/db/schema";
import { users } from "@/lib/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { AssetFilesSection } from "./AssetFilesSection";
import { AssetWorkOrdersList } from "./AssetWorkOrdersList";
import { AssetActions } from "./AssetActions";
import {
  formatDowntimeMinutesSpanish,
} from "@/lib/machine-downtime";

async function getAsset(id: string) {
  const asset = await db.query.assets.findFirst({
    where: eq(assets.id, id),
  });
  if (!asset) return null;
  const [workOrdersList, files, downtimeRow] = await Promise.all([
    db
      .select({
        id: workOrders.id,
        title: workOrders.title,
        status: workOrders.status,
        dueDate: workOrders.dueDate,
        priority: workOrders.priority,
        createdAt: workOrders.createdAt,
        assigneeId: users.id,
        assigneeAvatarUrl: users.avatarUrl,
        assigneeName: users.name,
      })
      .from(workOrders)
      .leftJoin(users, eq(workOrders.assigneeId, users.id))
      .where(eq(workOrders.assetId, id))
      .orderBy(desc(workOrders.createdAt)),
    db.query.assetFiles.findMany({
      where: eq(assetFiles.assetId, id),
      orderBy: (f, { desc }) => [desc(f.createdAt)],
    }),
    db
      .select({
        totalMinutes: sql<number>`
          coalesce(sum(
            case when ${workOrders.status} = 'completed' then
              (case when ${workOrders.countsMachineDowntime} = true
                    and ${workOrders.startedAt} is not null
                    and ${workOrders.completedAt} is not null
                then floor(extract(epoch from (${workOrders.completedAt} - ${workOrders.startedAt})) / 60)
                else 0 end) + coalesce(${workOrders.manualDowntimeMinutes}, 0)
            else 0 end
          ), 0)::int
        `.mapWith(Number),
      })
      .from(workOrders)
      .where(eq(workOrders.assetId, id)),
  ]);
  const downtimeTotalMinutes = downtimeRow[0]?.totalMinutes ?? 0;
  return { ...asset, workOrders: workOrdersList, files, downtimeTotalMinutes };
}

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const asset = await getAsset(id);
  if (!asset) notFound();
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Link
              href="/assets"
              className="inline-flex items-center gap-1 text-sm font-medium text-[#F14C03] hover:underline"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Maquinas
            </Link>
            <span aria-hidden className="text-zinc-400">
              /
            </span>
            <h1 className="text-xl font-semibold text-zinc-900">{asset.name}</h1>
          </div>
          <AssetActions id={asset.id} name={asset.name} />
        </div>
        <p className="text-zinc-500">{asset.assetId}</p>
      </div>
      <section
        aria-labelledby="downtime-heading"
        className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
      >
        <h2 id="downtime-heading" className="text-sm font-semibold text-zinc-900">
          Paro de máquina acumulado
        </h2>
        {asset.tracksMachineDowntime === false ? (
          <p className="mt-2 text-sm text-zinc-600">
            El seguimiento de paro de máquina está desactivado para este activo. Puedes activarlo
            al editar la máquina.
          </p>
        ) : (
          <>
            <p className="mt-1 text-xs text-zinc-500">
              Suma de tareas completadas con paro automático (en curso → terminada) más paro manual
              registrado en cada tarea.
            </p>
            <p className="mt-3 text-2xl font-semibold tabular-nums text-zinc-900">
              {formatDowntimeMinutesSpanish(asset.downtimeTotalMinutes)}
            </p>
          </>
        )}
      </section>

      <AssetFilesSection assetId={id} initialFiles={asset.files} />

      {asset.workOrders.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-zinc-500 mb-2">Tareas</h2>
          <AssetWorkOrdersList workOrders={asset.workOrders} />
        </section>
      )}
    </div>
  );
}
