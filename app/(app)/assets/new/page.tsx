import { AssetForm } from "../AssetForm";

export default async function NewAssetPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string }>;
}) {
  const sp = await searchParams;
  const initialGroupId = sp.group?.trim() || null;

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <AssetForm initialGroupId={initialGroupId} />
    </div>
  );
}
