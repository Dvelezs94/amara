import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AndroidAppDownloadLink } from "@/components/AndroidAppDownloadLink";
import { LoginForm } from "./LoginForm";
import Link from "next/link";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/tareas");
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-surface">
      {/* Plain <img>: next/image optimizer returns an empty file for this PNG. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/amissa-logo.png"
        alt="Amissa"
        width={96}
        height={111}
        className="mb-6 h-24 w-auto rounded-2xl"
      />
      <h1 className="text-xl font-semibold text-zinc-900 mb-6">Iniciar sesión</h1>
      <div className="flex w-full max-w-xs flex-col gap-3">
        <LoginForm />
      </div>
      <Link href="/orden" className="mt-6 text-sm font-medium text-primary-600">
        Crear una orden sin iniciar sesión
      </Link>
      <AndroidAppDownloadLink />
    </div>
  );
}
