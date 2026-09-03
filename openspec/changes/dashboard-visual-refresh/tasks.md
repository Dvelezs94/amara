## 1. Helper de presentación

- [x] 1.1 Crear `lib/dashboard-presentation.ts` con el catálogo de 5 KPIs (id, title, hint, tone) y `dashboardEmptyCopy` para tareas, eventos y checklists (mensaje + href). Verificar en `tests/unit/dashboard-presentation.test.ts` que hay cinco KPIs y que los hrefs son `/tareas`, `/calendario` y `/checklists`
- [x] 1.2 Añadir `formatDashboardContextBanner({ from, to, windowDays })` (texto en español con días de ventana). Verificar con tests unitarios para 30 días y para un día
- [x] 1.3 Ejecutar `npm test` y verificar que el nuevo archivo de tests pasa

## 2. Dashboard page

- [x] 2.1 Añadir franja de contexto encima de los KPIs usando el helper y `formatDashboardRangeTrigger`. Verificar en `/dashboard` que el rango o los días de ventana son visibles
- [x] 2.2 Rediseñar las 5 tarjetas KPI (icono, valor, hint, borde/acento por `tone` con clases en el componente). Verificar que MTTR, Inactividad, Paro, Planificado y OEE siguen mostrando las mismas unidades (`h` / `%`)
- [x] 2.3 Mostrar skeleton `animate-pulse` en KPIs y listas mientras `loading` es true. Verificar recargando `/dashboard` que no se ven ceros definitivos sin carga
- [x] 2.4 Cabeceras con icono + empty states con CTA en Tareas y Eventos; hover en filas. Verificar empty: mensaje + enlace; con datos: hover y enlace a `/tareas/{id}`

## 3. Checklists del día

- [x] 3.1 Alinear `DashboardChecklistsSection` (cabecera, empty con CTA a `/checklists`, skeleton de carga, hover). Verificar navegación de día y empty state
- [x] 3.2 Actualizar `AGENTS.md` (párrafo del dashboard) y coverage map con `lib/dashboard-presentation.ts`. Verificar que el archivo está citado
