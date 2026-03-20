"use client";

import { useEffect, useMemo, useState } from "react";
import { AVAILABLE_USER_ROLES, type UserRole } from "@/lib/auth-shared";

type AdminUser = {
  id: string;
  username: string;
  name: string;
  email: string | null;
  role: UserRole;
  createdAt: string;
};

const roleLabel: Record<UserRole, string> = {
  technician: "Tecnico",
  supervisor: "Supervisor",
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

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="text-base font-semibold text-zinc-900">Invitar usuario</h2>
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
              defaultValue="technician"
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
            {loading ? "Enviando..." : "Invitar usuario"}
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
              <p className="text-sm font-medium text-zinc-900">{user.name}</p>
              <p className="text-xs text-zinc-500">@{user.username}</p>
              {user.email ? (
                <p className="text-xs text-zinc-500">{user.email}</p>
              ) : null}
              <p className="text-xs text-zinc-600">
                Rol: {roleLabel[user.role]} - Alta:{" "}
                {new Date(user.createdAt).toLocaleDateString()}
              </p>
            </li>
          ))}
          {users.length === 0 && (
            <li className="py-4 text-sm text-zinc-500">
              No hay usuarios registrados aun.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}
