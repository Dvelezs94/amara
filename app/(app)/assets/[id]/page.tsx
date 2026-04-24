import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { assets } from "@/lib/db/schema";
import { workOrders } from "@/lib/db/schema";
import { assetFiles } from "@/lib/db/schema";
import { users } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { AssetFilesSection } from "./AssetFilesSection";
import { AssetWorkOrdersList } from "./AssetWorkOrdersList";

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
          <h2 className="text-sm font-medium text-zinc-500 mb-2">Tareas</h2>
          <AssetWorkOrdersList workOrders={asset.workOrders} />
        </section>
      )}
    </div>
  );
}
