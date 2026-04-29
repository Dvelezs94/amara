import { getSession } from "@/lib/auth";
import { ProfilePhotoUpload } from "./ProfilePhotoUpload";

function roleLabel(role: string) {
  if (role === "operator") return "Operador";
  if (role === "admin") return "Administrador";
  if (role === "supervisor") return "Supervisor";
  return role;
}

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) return null;
  const role = roleLabel(session.role);
  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-xl font-semibold text-zinc-900">Perfil</h1>
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <ProfilePhotoUpload
          userId={session.id}
          name={session.name}
          initialAvatarUrl={session.avatarUrl}
        />
      </div>
      <div className="rounded-xl border border-primary-200 bg-primary-50 p-3 dark:border-slate-700 dark:bg-slate-800">
        <p className="text-xs uppercase tracking-wide text-primary-700 dark:text-primary-300">
          Resumen de perfil
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="inline-flex rounded-full bg-white px-3 py-1 text-sm font-semibold text-zinc-900 dark:bg-slate-700 dark:text-slate-100">
            {session.name}
          </span>
          <span className="inline-flex rounded-full bg-white px-3 py-1 text-sm font-semibold text-primary-700 dark:bg-slate-700 dark:text-primary-300">
            {role}
          </span>
        </div>
      </div>
      <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-3">
        <div>
          <p className="text-sm text-zinc-500">Nombre</p>
          <p className="font-medium text-zinc-900">{session.name}</p>
        </div>
        <div>
          <p className="text-sm text-zinc-500">Correo electrónico</p>
          <p className="font-medium text-zinc-900">
            {session.email ?? "No configurado"}
          </p>
        </div>
        <div>
          <p className="text-sm text-zinc-500">Usuario</p>
          <p className="font-medium text-zinc-900">{session.username}</p>
        </div>
        <div>
          <p className="text-sm text-zinc-500">Rol</p>
          <p className="font-medium text-zinc-900">{role}</p>
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
