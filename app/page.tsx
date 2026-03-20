import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Link from "next/link";

export default async function HomePage() {
  const session = await getSession();
  if (session) redirect("/work-orders");
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-surface">
      <h1 className="text-2xl font-semibold mb-1 text-[rgb(var(--color-text-strong))]">
        AmiMaint
      </h1>
      <p className="mb-8 text-center text-[rgb(var(--color-text))]">
        Gestión de mantenimiento AMISSA
      </p>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Link
          href="/login"
          className="rounded-xl bg-primary-600 text-white py-3 px-4 text-center font-medium tap-target"
        >
          Iniciar sesión
        </Link>
        <Link
          href="/solicitud"
          className="rounded-xl border border-zinc-300 dark:border-slate-600 py-3 px-4 text-center font-medium tap-target text-[rgb(var(--color-text))]"
        >
          Abrir solicitud
        </Link>
      </div>
    </div>
  );
}
