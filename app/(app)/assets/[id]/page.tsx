import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { assets } from "@/lib/db/schema";
import { workOrders } from "@/lib/db/schema";
import { assetFiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { AssetFilesSection } from "./AssetFilesSection";
import {
  parseWorkOrderKind,
  workOrderKindBadgeClass,
  workOrderKindLabel,
} from "@/lib/work-order-kind";

async function getAsset(id: string) {
  const asset = await db.query.assets.findFirst({
    where: eq(assets.id, id),
  });
  if (!asset) return null;
  const [workOrdersList, files] = await Promise.all([
    db
      .select({
        id: workOrders.id,
        title: workOrders.title,
        status: workOrders.status,
        dueDate: workOrders.dueDate,
        kind: workOrders.kind,
      })
      .from(workOrders)
      .where(eq(workOrders.assetId, id)),
    db.query.assetFiles.findMany({
      where: eq(assetFiles.assetId, id),
      orderBy: (f, { desc }) => [desc(f.createdAt)],
    }),
  ]);
  return { ...asset, workOrders: workOrdersList, files };
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
        <div className="flex flex-wrap items-center gap-2">
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
        <p className="text-zinc-500">{asset.assetId}</p>
      </div>
      <AssetFilesSection assetId={id} initialFiles={asset.files} />

      {asset.workOrders.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-zinc-500 mb-2">
            Órdenes de trabajo
          </h2>
          <ul className="space-y-2">
            {asset.workOrders.map((wo) => (
              <li key={wo.id}>
                <Link
                  href={`/tareas/${wo.id}`}
                  className="block rounded-lg border border-zinc-200 bg-white p-3 hover:border-primary-200"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-zinc-900">{wo.title}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${workOrderKindBadgeClass(
                        parseWorkOrderKind(wo.kind)
                      )}`}
                    >
                      {workOrderKindLabel(parseWorkOrderKind(wo.kind))}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500">
                    {wo.status === "pending" ? "Pendiente" : wo.status === "in_progress" ? "En curso" : wo.status === "completed" ? "Completada" : wo.status} · Vence{" "}
                    {wo.dueDate
                      ? new Date(wo.dueDate).toLocaleDateString("es")
                      : "—"}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
