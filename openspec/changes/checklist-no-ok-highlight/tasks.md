## 1. Helper

- [x] 1.1 Reutilizar `checklistDropdownValueIsNoOk` desde `lib/dashboard-checklists.ts` (sin cambios de API si ya cubre el caso). Verificar que `npm test -- tests/unit/dashboard-checklists.test.ts` pasa

## 2. UI web

- [x] 2.1 En `WorkOrderDetail`, cuando `status === "completed"` y el checklist está en solo lectura, resaltar en rojo los valores dropdown detectados como NO OK. Verificar con una tarea completada que tenga «NO OK»
- [x] 2.2 Asegurar que «OK» / otros valores y tareas no completadas no reciben el resaltado. Verificar en la misma pantalla

## 3. Docs y tests

- [x] 3.1 Actualizar `AGENTS.md` (checklists / detalle de tarea) mencionando el resaltado NO OK solo en web cuando la tarea está completada. Verificar que el texto está presente
- [x] 3.2 Ejecutar `npm test` y reportar resultados
