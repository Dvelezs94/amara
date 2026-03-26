import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LoginForm } from "./LoginForm";
import Link from "next/link";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/work-orders");
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-surface">
      <h1 className="text-xl font-semibold text-zinc-900 mb-6">Iniciar sesión</h1>
      <LoginForm />
      <Link
        href="/solicitud"
        className="mt-6 text-sm font-medium text-primary-600"
      >
        Crear una solicitud sin iniciar sesión
      </Link>
    </div>
  );
}
