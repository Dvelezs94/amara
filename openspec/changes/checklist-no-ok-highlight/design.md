## Context

See proposal.md — Why. En web, `WorkOrderDetail` renderiza checklist en solo lectura cuando `!checklistEditable`. El valor del dropdown se muestra como `String(item.value)` sin estilo especial. Ya existe `checklistDropdownValueIsNoOk` en `lib/dashboard-checklists.ts`.

## Goals / Non-Goals

**Goals:**
- Resaltado rojo claro en campos dropdown «NO OK» en la **web**, solo si la tarea está **completada**
- Reutilizar el detector del dashboard

**Non-Goals:**
- App móvil (sin cambios)
- Resaltar en tareas canceladas, pendientes o en edición
- Cambiar cierre/validación del checklist
- Resaltar textos libres fuera de dropdowns

## Decisions

### 1. Cuándo aplicar el resaltado
**Decisión:** Solo cuando `status === "completed"` (y el checklist se ve en solo lectura). No en cancelada ni mientras se edita.
**Alternativa:** Cualquier solo lectura (incl. cancelada) — descartado por pedido del usuario.

### 2. Reutilizar detector existente
**Decisión:** Importar `checklistDropdownValueIsNoOk` desde `lib/dashboard-checklists.ts` en `WorkOrderDetail`.
**Alternativa:** Extraer a `lib/checklist-no-ok.ts` — innecesario si solo se usa en un componente web además del dashboard.

### 3. Estilo visual
**Decisión:** Contenedor con borde/fondo rojo suave + texto en rojo (`text-red-700`, `bg-red-50`, `border-red-200`). Clases Tailwind en el componente.

### 4. Alcance de items
**Decisión:** Solo `custom_field` + `fieldType === "dropdown"`.

## Risks / Trade-offs

- **Falsos positivos** de substring «no ok» → Mitigación: misma regex del dashboard.
- **Contraste** → Mitigación: utilidades rojo estándar en tema claro.

## Migration Plan

Sin migración. Rollback = quitar estilos en `WorkOrderDetail`.
