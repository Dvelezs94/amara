import { getSession } from "@/lib/auth";
import { InviteUsersPanel } from "./InviteUsersPanel";

export default async function UsersPage() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
        No tienes permisos para administrar usuarios.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-500">
        Invita usuarios nuevos y asigna su rol desde aquí.
      </p>
      <InviteUsersPanel />
    </div>
  );
}
