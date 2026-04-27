import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { auditLogs, users } from "@/lib/db/schema";
import { APP_TIME_ZONE } from "@/lib/timezone";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function LogsPage() {
  const session = await getSession();
  if (!session) {
    return null;
  }
  if (session.role !== "admin") {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
        No tienes permisos para ver los logs de plataforma.
      </div>
    );
  }

  const logs = await db
    .select({
      id: auditLogs.id,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      action: auditLogs.action,
      metadata: auditLogs.metadata,
      createdAt: auditLogs.createdAt,
      userName: users.name,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.userId, users.id))
    .orderBy(desc(auditLogs.createdAt))
    .limit(100);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">
            Logs de plataforma
          </h1>
          <p className="text-sm text-zinc-500">
            Usuarios, órdenes, activos, checklist, calendario de mantenimiento y
            más.
          </p>
        </div>
      </header>

      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        <div className="grid grid-cols-12 gap-2 border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-500">
          <div className="col-span-3">Fecha</div>
          <div className="col-span-2">Usuario</div>
          <div className="col-span-2">Entidad</div>
          <div className="col-span-2">Acción</div>
          <div className="col-span-3">Detalle</div>
        </div>
        {logs.length === 0 ? (
          <div className="px-4 py-6 text-sm text-zinc-500">
            Aún no hay eventos registrados.
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {logs.map((log) => (
              <li key={log.id} className="grid grid-cols-12 gap-2 px-3 py-2 text-xs">
                <div className="col-span-3 text-zinc-500">
                  {new Date(log.createdAt).toLocaleString("es-MX", {
                    timeZone: APP_TIME_ZONE,
                  })}
                </div>
                <div className="col-span-2 text-zinc-700">
                  {log.userName ??
                    (log.action === "created_from_public_form"
                      ? "Público (/solicitud)"
                      : "Sistema")}
                </div>
                <div className="col-span-2 text-zinc-700">
                  {log.entityType}
                </div>
                <div className="col-span-2 text-zinc-700">
                  {log.action}
                </div>
                <div className="col-span-3 text-zinc-500 truncate">
                  {log.entityId}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

