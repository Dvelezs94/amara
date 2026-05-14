import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { assets } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { AssetEditForm } from "./AssetEditForm";

async function getAsset(id: string) {
  return db.query.assets.findFirst({
    where: eq(assets.id, id),
  });
}

export default async function EditAssetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const asset = await getAsset(id);
  if (!asset) notFound();

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <h1 className="text-xl font-semibold text-zinc-900">Editar máquina</h1>
      <AssetEditForm
        id={id}
        initialName={asset.name}
        initialAssetId={asset.assetId}
        initialTracksMachineDowntime={asset.tracksMachineDowntime !== false}
      />
      <Link
        href={`/assets/${id}`}
        className="block text-center text-sm text-primary-600"
      >
        Volver al activo
      </Link>
    </div>
  );
}
