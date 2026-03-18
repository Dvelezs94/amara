import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Link from "next/link";

export default async function HomePage() {
  const session = await getSession();
  if (session) redirect("/work-orders");
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-primary-50 to-white">
      <h1 className="text-2xl font-semibold text-zinc-900 mb-1">
        AmiMaint
      </h1>
      <p className="text-zinc-600 mb-8 text-center">
        Gestión de mantenimiento, prioridad móvil
      </p>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Link
          href="/login"
          className="rounded-xl bg-primary-600 text-white py-3 px-4 text-center font-medium tap-target"
        >
          Iniciar sesión
        </Link>
        <Link
          href="/signup"
          className="rounded-xl border border-zinc-300 text-zinc-700 py-3 px-4 text-center font-medium tap-target"
        >
          Registrarse
        </Link>
      </div>
    </div>
  );
}
