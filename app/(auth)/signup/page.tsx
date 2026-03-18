import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { SignupForm } from "./SignupForm";
import Link from "next/link";

export default async function SignupPage() {
  const session = await getSession();
  if (session) redirect("/work-orders");
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-surface">
      <h1 className="text-xl font-semibold text-zinc-900 mb-6">Registrarse</h1>
      <SignupForm />
      <p className="mt-6 text-sm text-zinc-500">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="text-primary-600 font-medium">
          Iniciar sesión
        </Link>
      </p>
    </div>
  );
}
