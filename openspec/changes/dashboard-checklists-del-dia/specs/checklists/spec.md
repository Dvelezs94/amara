## MODIFIED Requirements

### Requirement: Detección de prioridad en checklist
El sistema SHALL exponer una función helper que determine si un checklist es prioridad basándose en: (1) al menos un campo `custom_field` tipo dropdown con valor que contenga «NO OK» (case-insensitive), o (2) la tarea asociada tiene notas/comentarios. Helper en `lib/dashboard-checklists.ts`.

#### Scenario: Campo dropdown con NO OK detectado
- **GIVEN** un checklist con un item de tipo `custom_field`, `fieldType: "dropdown"`, y `value` que contiene "NO OK"
- **WHEN** se evalúa la prioridad
- **THEN** `isPriority` es `true`

#### Scenario: Campo dropdown con OK no es prioridad
- **GIVEN** un checklist con un item dropdown cuyo valor es "OK"
- **WHEN** se evalúa la prioridad
- **THEN** `isPriority` es `false`

#### Scenario: Tarea con notas es prioridad
- **GIVEN** un checklist cuya tarea tiene al menos una nota
- **WHEN** se evalúa la prioridad
- **THEN** `isPriority` es `true`
