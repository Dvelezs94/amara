## Purpose
Sección del dashboard que muestra los checklists del día seleccionado con navegación por fecha y marcado de prioridad.

## ADDED Requirements

### Requirement: Vista de checklists del día en dashboard
El dashboard SHALL mostrar una sección con los checklists (instancias de `work_order_checklist` agrupadas por tarea) correspondientes al día seleccionado, indicando su estado de completitud.

#### Scenario: Ver checklists de hoy
- **GIVEN** un usuario autenticado en el dashboard
- **WHEN** abre el dashboard sin seleccionar fecha
- **THEN** ve los checklists de tareas con actividad hoy (completados y pendientes)

#### Scenario: Ver checklists de otro día
- **GIVEN** un usuario en la sección de checklists del dashboard
- **WHEN** navega al día anterior o siguiente
- **THEN** la lista se actualiza mostrando los checklists de ese día

### Requirement: Navegación por fecha
La sección de checklists SHALL permitir navegar entre días con controles de día anterior y día siguiente.

#### Scenario: Navegar al día anterior
- **GIVEN** un usuario viendo checklists del 15 de septiembre
- **WHEN** presiona el botón de día anterior
- **THEN** ve los checklists del 14 de septiembre

### Requirement: Marcado de prioridad
Un checklist SHALL marcarse como prioridad cuando contenga al menos un campo con valor «NO OK» o tenga notas/comentarios asociados a la tarea.

#### Scenario: Checklist con campo NO OK marcado como prioridad
- **GIVEN** un checklist con un campo dropdown cuyo valor es «NO OK»
- **WHEN** se muestra en la sección del dashboard
- **THEN** aparece con indicador visual de prioridad

#### Scenario: Checklist con comentarios marcado como prioridad
- **GIVEN** una tarea con checklist que tiene notas asociadas
- **WHEN** se muestra en la sección del dashboard
- **THEN** aparece con indicador visual de prioridad

#### Scenario: Checklist sin problemas sin marcado
- **GIVEN** un checklist sin campos NO OK y sin notas
- **WHEN** se muestra en la sección del dashboard
- **THEN** aparece sin indicador de prioridad

### Requirement: API de checklists por fecha
El endpoint `GET /api/dashboard/checklists` SHALL aceptar un parámetro `date` (YYYY-MM-DD) y devolver los checklists del día con indicadores de prioridad.

#### Scenario: Consultar checklists por fecha
- **WHEN** se llama a `GET /api/dashboard/checklists?date=2026-09-03`
- **THEN** devuelve los checklists con actividad en esa fecha, cada uno con flag `isPriority`

### Requirement: Acceso por rol
La sección de checklists del dashboard y su API SHALL ser accesible para admin, técnico y calidad.

#### Scenario: Técnico ve checklists en dashboard
- **GIVEN** un usuario con rol `tecnico`
- **WHEN** accede al endpoint de checklists del dashboard
- **THEN** obtiene los checklists del día (filtrados a lo que su rol permite ver)

#### Scenario: Calidad ve checklists en dashboard
- **GIVEN** un usuario con rol `calidad`
- **WHEN** accede al endpoint de checklists del dashboard
- **THEN** obtiene los checklists del día
