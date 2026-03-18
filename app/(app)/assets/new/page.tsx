import { AssetForm } from "../AssetForm";

export default function NewAssetPage() {
  return (
    <div className="max-w-lg mx-auto space-y-4">
      <h1 className="text-xl font-semibold text-zinc-900">Añadir activo</h1>
      <AssetForm />
    </div>
  );
}
