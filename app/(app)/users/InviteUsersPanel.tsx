"use client";

import { useEffect, useMemo, useState } from "react";
import { AVAILABLE_USER_ROLES, type UserRole } from "@/lib/auth-shared";
import { UserAvatar } from "@/components/UserAvatar";

type AdminUser = {
  id: string;
  username: string;
  name: string;
  email: string | null;
  role: UserRole;
  createdAt: string;
  avatarUrl: string | null;
  avatarBackgroundColor: string | null;
};

const roleLabel: Record<UserRole, string> = {
  operator: "Operador",
  admin: "Administrador",
};

function generatePassword() {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  let out = "";
  for (let i = 0; i < 12; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export function InviteUsersPanel() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [password, setPassword] = useState(() => generatePassword());
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [uploadingAvatarUserId, setUploadingAvatarUserId] = useState<string | null>(
    null
  );
  const [resetModalUser, setResetModalUser] = useState<AdminUser | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState("");

  async function loadUsers() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json().catch(() => []);
      if (!res.ok) {
        setError(data.error ?? "No se pudo cargar la lista");
        setRefreshing(false);
        return;
      }
      setUsers(Array.isArray(data) ? data : []);
    } catch {
      setError("No se pudo cargar la lista");
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  const roleOptions = useMemo(
    () =>
      AVAILABLE_USER_ROLES.map((role) => ({
        value: role,
        label: roleLabel[role],
      })),
    []
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const form = e.currentTarget;
    const name = (form.elements.namedItem("name") as HTMLInputElement).value.trim();
    const username = (form.elements.namedItem("username") as HTMLInputElement)
      .value.trim()
      .toLowerCase();
    const email = (form.elements.namedItem("email") as HTMLInputElement).value
      .trim()
      .toLowerCase();
    const role = (form.elements.namedItem("role") as HTMLSelectElement)
      .value as UserRole;

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, username, email, role, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "No se pudo enviar la invitacion");
        setLoading(false);
        return;
      }
      setSuccess("Usuario invitado correctamente.");
      form.reset();
      setPassword(generatePassword());
      await loadUsers();
    } catch {
      setError("No se pudo enviar la invitacion");
    } finally {
      setLoading(false);
    }
  }

  async function resetPasswordForUser(user: AdminUser, nextPassword: string) {
    setError(null);
    setSuccess(null);
    setResettingUserId(user.id);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: nextPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "No se pudo resetear la contrasena");
        return;
      }
      setSuccess(
        `Contrasena de ${user.name} restablecida. Temporal: ${nextPassword}`
      );
    } catch {
      setError("No se pudo resetear la contrasena");
    } finally {
      setResettingUserId(null);
    }
  }

  async function uploadAvatarForUser(user: AdminUser, file: File) {
    setError(null);
    setSuccess(null);
    setUploadingAvatarUserId(user.id);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/admin/users/${user.id}/avatar`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "No se pudo subir la foto");
        return;
      }
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id ? { ...u, avatarUrl: data.avatarUrl ?? null } : u
        )
      );
      setSuccess(`Foto de ${user.name} actualizada.`);
    } catch {
      setError("No se pudo subir la foto");
    } finally {
      setUploadingAvatarUserId(null);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="text-base font-semibold text-zinc-900">Agregar usuario</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Crea el usuario y define su rol desde el inicio.
        </p>
        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          {error && (
            <p className="rounded-lg bg-red-50 p-2 text-sm text-red-600">{error}</p>
          )}
          {success && (
            <p className="rounded-lg bg-green-50 p-2 text-sm text-green-700">
              {success}
            </p>
          )}
          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-medium text-zinc-700">
              Nombre
            </label>
            <input
              id="name"
              name="name"
              required
              type="text"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div>
            <label htmlFor="username" className="mb-1 block text-sm font-medium text-zinc-700">
              Usuario
            </label>
            <input
              id="username"
              name="username"
              required
              type="text"
              autoComplete="username"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-zinc-700">
              Email (opcional)
            </label>
            <input
              id="email"
              name="email"
              type="email"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div>
            <label htmlFor="role" className="mb-1 block text-sm font-medium text-zinc-700">
              Rol
            </label>
            <select
              id="role"
              name="role"
              defaultValue="operator"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-zinc-700">
              Contrasena temporal
            </label>
            <div className="flex gap-2">
              <input
                id="password"
                name="password"
                required
                minLength={8}
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              <button
                type="button"
                onClick={() => setPassword(generatePassword())}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700"
              >
                Generar
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-primary-600 px-4 py-3 font-medium text-white tap-target disabled:opacity-60"
          >
            {loading ? "Enviando..." : "Agregar usuario"}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-900">Usuarios</h2>
          <button
            type="button"
            onClick={loadUsers}
            disabled={refreshing}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 disabled:opacity-60"
          >
            {refreshing ? "Actualizando..." : "Actualizar"}
          </button>
        </div>
        <ul className="mt-3 divide-y divide-zinc-100">
          {users.map((user) => (
            <li key={user.id} className="py-2">
              <div className="flex items-start gap-3">
                <UserAvatar
                  userId={user.id}
                  name={user.name}
                  avatarUrl={user.avatarUrl}
                  avatarBackgroundColor={user.avatarBackgroundColor}
                  size="md"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-900">{user.name}</p>
                  <p className="text-xs text-zinc-500">@{user.username}</p>
                  {user.email ? (
                    <p className="text-xs text-zinc-500">{user.email}</p>
                  ) : null}
                  <p className="text-xs text-zinc-600">
                    Rol: {roleLabel[user.role]} - Alta:{" "}
                    {new Date(user.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setResetModalUser(user);
                    setResetPasswordValue(generatePassword());
                  }}
                  disabled={resettingUserId === user.id}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
                >
                  {resettingUserId === user.id
                    ? "Reseteando..."
                    : "Resetear contrasena"}
                </button>
                <label className="cursor-pointer rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50">
                  {uploadingAvatarUserId === user.id
                    ? "Subiendo foto..."
                    : "Subir foto"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploadingAvatarUserId === user.id}
                    onChange={async (e) => {
                      const file = e.currentTarget.files?.[0];
                      e.currentTarget.value = "";
                      if (!file) return;
                      await uploadAvatarForUser(user, file);
                    }}
                  />
                </label>
              </div>
            </li>
          ))}
          {users.length === 0 && (
            <li className="py-4 text-sm text-zinc-500">
              No hay usuarios registrados aun.
            </li>
          )}
        </ul>
      </section>
      {resetModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-4 shadow-xl">
            <h3 className="text-base font-semibold text-zinc-900">
              Resetear contrasena
            </h3>
            <p className="mt-1 text-sm text-zinc-600">
              Usuario: <span className="font-medium">{resetModalUser.name}</span>
            </p>
            <div className="mt-3 space-y-2">
              <label
                htmlFor="reset-password"
                className="block text-sm font-medium text-zinc-700"
              >
                Nueva contrasena
              </label>
              <div className="flex gap-2">
                <input
                  id="reset-password"
                  type="text"
                  minLength={8}
                  value={resetPasswordValue}
                  onChange={(e) => setResetPasswordValue(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
                <button
                  type="button"
                  onClick={() => setResetPasswordValue(generatePassword())}
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700"
                >
                  Generar
                </button>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setResetModalUser(null);
                  setResetPasswordValue("");
                }}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={resetPasswordValue.trim().length < 8}
                onClick={async () => {
                  if (!resetModalUser) return;
                  const pass = resetPasswordValue.trim();
                  if (pass.length < 8) return;
                  await resetPasswordForUser(resetModalUser, pass);
                  setResetModalUser(null);
                  setResetPasswordValue("");
                }}
                className="rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                Confirmar cambio de contraseña
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
