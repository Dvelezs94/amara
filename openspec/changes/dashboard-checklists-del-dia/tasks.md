## 1. Helper de prioridad y agrupación

- [x] 1.1 Crear `lib/dashboard-checklists.ts` con función `isChecklistPriority(items: {type, fieldType, value}[], hasNotes: boolean): boolean` — retorna `true` si algún item dropdown contiene "NO OK" (case-insensitive) o si `hasNotes` es `true`. Verificar con tests unitarios en `tests/unit/dashboard-checklists.test.ts`
- [x] 1.2 Agregar función `groupChecklistsByWorkOrder(rows)` que agrupe items de `work_order_checklist` por `workOrderId` y calcule estado (completados/total). Verificar con tests unitarios
- [x] 1.3 Verificar que `npm test` pasa con los nuevos tests

## 2. API endpoint

- [x] 2.1 Crear `app/api/dashboard/checklists/route.ts` con handler GET que acepte `?date=YYYY-MM-DD`, consulte checklists del día (por `updatedAt` de la tarea en zona America/Monterrey), calcule prioridad por cada grupo, y retorne JSON. Verificar con respuesta correcta al hacer GET manual
- [x] 2.2 Agregar `/api/dashboard/checklists` a las listas blancas de API de técnico y calidad en `lib/middleware-rules.ts`. Verificar que tests de middleware pasan (`npm test`)

## 3. UI del dashboard

- [x] 3.1 Crear componente `DashboardChecklistsSection` en `app/(app)/dashboard/` que muestre checklists del día con indicador de prioridad (badge naranja o rojo), nombre de tarea, template usado, y progreso (items completados/total). Verificar que renderiza correctamente en `/dashboard`
- [x] 3.2 Agregar controles de navegación por fecha (botones anterior/siguiente + label del día) con estado local. Verificar que al cambiar día se recarga la data
- [x] 3.3 Integrar la sección en `app/(app)/dashboard/page.tsx` después de la sección de tareas pendientes. Verificar que aparece en el dashboard

## 4. Documentación y limpieza

- [x] 4.1 Actualizar `AGENTS.md` con la nueva sección de checklists del dashboard. Verificar que la descripción del dashboard menciona checklists
- [x] 4.2 Agregar cobertura de `lib/dashboard-checklists.ts` al coverage map en `AGENTS.md`. Verificar que está listado
