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
      <p className="mt-6 text-sm text-zinc-500">
        ¿No tienes cuenta?{" "}
        <Link href="/signup" className="text-primary-600 font-medium">
          Registrarse
        </Link>
      </p>
    </div>
  );
}
