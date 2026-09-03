## Why

Cuando una tarea queda completada, el checklist se muestra en solo lectura y los valores «NO OK» se ven igual que un «OK». Quien revisa en la web tarda en localizar los campos que requieren acción.

## What Changes

- Resaltar en rojo (texto y/o fondo) los campos dropdown cuyo valor contiene «NO OK» (case-insensitive) cuando la tarea está **completada** y el checklist se ve en solo lectura en la web
- Reutilizar la detección existente `checklistDropdownValueIsNoOk` (`lib/dashboard-checklists.ts`)
- Tests unitarios del criterio de presentación si se añade helper de UI; cubrir con tests existentes del detector

## Capabilities

### New Capabilities

### Modified Capabilities
- `checklists`: Resaltado visual de campos con valor «NO OK» en checklist solo lectura en web, solo si la tarea está completada

## Impact

- **UI web:** `app/(app)/tareas/[id]/WorkOrderDetail.tsx` (rama solo lectura + `status === "completed"`)
- **Lib:** reutilizar `lib/dashboard-checklists.ts` (`checklistDropdownValueIsNoOk`)
- **Tests:** web (`npm test`)
- **Roles afectados:** admin, técnico, calidad (detalle de tarea en web)
- **Migración:** no
- **Móvil:** no
