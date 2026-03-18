import { getSession } from "@/lib/auth";
import Link from "next/link";

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) return null;
  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-xl font-semibold text-zinc-900">Perfil</h1>
      <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-3">
        <div>
          <p className="text-sm text-zinc-500">Nombre</p>
          <p className="font-medium text-zinc-900">{session.name}</p>
        </div>
        <div>
          <p className="text-sm text-zinc-500">Correo electrónico</p>
          <p className="font-medium text-zinc-900">{session.email}</p>
        </div>
        <div>
          <p className="text-sm text-zinc-500">Rol</p>
          <p className="font-medium text-zinc-900">{session.role === "technician" ? "Técnico" : session.role === "supervisor" ? "Supervisor" : session.role === "admin" ? "Administrador" : session.role}</p>
        </div>
      </div>
      <form action="/api/auth/logout" method="POST">
        <button
          type="submit"
          className="w-full rounded-xl border border-zinc-300 py-3 px-4 text-center font-medium text-zinc-700 tap-target"
        >
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}
