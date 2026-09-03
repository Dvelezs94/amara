## Why

El dashboard actual es funcional pero visualmente plano: KPIs idénticos en tarjetas blancas, listas sin jerarquía y poco uso de color de marca. Quien abre `/dashboard` no percibe de un vistazo qué está bien, qué urge o qué hacer después.

## What Changes

- Rediseñar las tarjetas de KPI con icono, acento de color de marca y jerarquía tipográfica más clara (sin cambiar las fórmulas ni los datos)
- Unificar cabeceras de secciones (tareas, eventos, checklists del día, gráficos) con iconos y estados vacíos más útiles
- Añadir una franja de contexto al inicio (rango de fechas + resumen breve de la ventana) para dar sentido a los números
- Mejorar estados de carga (esqueleto en lugar de vacío) y hover en filas de listas
- Alinear visualmente `DashboardChecklistsSection` con el resto del dashboard
- Extraer helpers de presentación (clases de KPI, labels de estado vacío) a `lib/` para poder testearlos

## Capabilities

### New Capabilities
- `dashboard`: Presentación visual del dashboard (KPIs, listas, checklists del día, gráficos): jerarquía, acentos de marca, estados vacíos y de carga

### Modified Capabilities

## Impact

- **UI:** `app/(app)/dashboard/page.tsx`, `DashboardChecklistsSection.tsx`
- **Lib:** nuevo helper de presentación (clases/iconos de KPI, textos de empty state)
- **Tests:** unitarios del helper
- **No cambia:** APIs, KPIs numéricos, middleware, roles, app móvil
- **Roles afectados:** admin (única rol con `/dashboard`); técnico y calidad no ven esta página
- **Migración:** no
- **Móvil:** no
