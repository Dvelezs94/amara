import { and, eq, ilike, or } from "drizzle-orm";
import { workOrders } from "@/lib/db/schema";

/**
 * Ordenes creadas desde el formulario publico (/orden o legado /solicitud).
 * Excluye programadas (`routine`) y ordenes internas creadas solo desde la app.
 */
export const publicWebWorkOrderFilter = and(
  eq(workOrders.kind, "on_demand"),
  or(
    ilike(workOrders.description, "%Orden publica desde /orden%"),
    ilike(workOrders.description, "%Solicitud externa desde /solicitud%")
  )
);
