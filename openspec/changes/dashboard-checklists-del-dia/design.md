## Context

El dashboard actual (`app/(app)/dashboard/page.tsx`) muestra KPIs, tareas pendientes y eventos del calendario, pero no tiene visibilidad sobre checklists. Los checklists viven en `work_order_checklist` vinculados a `work_orders` por `workOrderId`. Los campos tipo dropdown pueden contener valores como «OK» / «NO OK». Las notas de tareas están en la tabla `notes`. Solo admin accede al dashboard actualmente; técnico y calidad no.

## Goals / Non-Goals

**Goals:**
- Sección de checklists del día en el dashboard con navegación día a día
- Detección de prioridad (NO OK en dropdowns o notas en la tarea)
- API endpoint accesible para admin, técnico y calidad
- Helper puro testeable para lógica de prioridad

**Non-Goals:**
- No se agrega acceso completo al dashboard para técnico/calidad — solo al endpoint de checklists
- No se modifica el schema de base de datos
- No se agrega filtrado por activo o área en esta iteración

## Decisions

### 1. Fecha de referencia para «checklists del día»
**Decisión:** Usar `work_orders.updatedAt` (o `completedAt` si existe) en la zona `America/Monterrey` para determinar qué checklists pertenecen a un día.
**Alternativa:** Usar `createdAt` de la tarea — descartado porque el checklist se llena durante el trabajo, no al crear la tarea.

### 2. Endpoint separado vs extender overview
**Decisión:** Crear `GET /api/dashboard/checklists?date=YYYY-MM-DD` como endpoint independiente.
**Alternativa:** Extender `/api/dashboard/overview` — descartado porque overview usa rangos y esta sección es por día exacto.

### 3. Detección de «NO OK»
**Decisión:** Un checklist es prioridad si algún item con `type: "custom_field"` y `fieldType: "dropdown"` tiene un `value` que contiene "NO OK" (case-insensitive), O si la tarea tiene al menos una nota en `notes`.
**Rationale:** Los dropdowns de checklists industriales típicamente usan «OK» / «NO OK» como opciones. Las notas indican observaciones que requieren seguimiento.

### 4. Acceso por rol al endpoint
**Decisión:** Agregar `/api/dashboard/checklists` a las listas blancas de API de técnico y calidad en `middleware-rules.ts`. No abrir `/dashboard` completo — el endpoint funciona de forma independiente y la UI de checklists puede integrarse en una ruta accesible.
**Alternativa:** Abrir dashboard completo — descartado por exceso de alcance.

### 5. Helper puro para prioridad
**Decisión:** Crear `lib/dashboard-checklists.ts` con funciones `isChecklistPriority(items, hasNotes)` y `groupChecklistsByWorkOrder(rows)` — puras, testeables sin DB.

## Risks / Trade-offs

- **Performance con muchos checklists por día** → Mitigación: la query filtra por fecha y limita a un día; para volúmenes esperados en AMISSA (<100 tareas/día) es aceptable.
- **Detección de NO OK depende de convención en opciones de dropdown** → Mitigación: búsqueda case-insensitive de substring "no ok" cubre variantes comunes. Si el cliente usa otra convención, se puede ampliar.
- **Técnico/calidad no ven el dashboard principal** → Mitigación: el endpoint es independiente; la sección de checklists se puede integrar también en otra vista si se decide más adelante.
