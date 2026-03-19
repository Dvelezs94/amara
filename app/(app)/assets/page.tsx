import Link from "next/link";
import { AssetList } from "./AssetList";

export default function AssetsPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900">Maquinas</h1>
        <Link
          href="/assets/new"
          className="rounded-xl bg-primary-600 text-white py-2.5 px-4 text-sm font-medium tap-target"
        >
          Añadir activo
        </Link>
      </div>
      <AssetList />
    </div>
  );
}
