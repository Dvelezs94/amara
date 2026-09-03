# Checklists

## Purpose
Plantillas de checklist, revisiones propuestas con aprobación por calidad, carpetas y validación al cerrar tareas.

## Requirements

### Requirement: Plantillas de checklist
El sistema SHALL soportar plantillas de checklist con campos configurables.

#### Scenario: Crear plantilla
- **GIVEN** un admin en `/checklists`
- **WHEN** crea una nueva plantilla con campos
- **THEN** la plantilla queda disponible para asignar a tareas

### Requirement: Revisiones propuestas
Las ediciones SHALL crear revisiones nombradas que calidad puede aprobar/rechazar.

#### Scenario: Calidad aprueba revisión
- **GIVEN** una revisión propuesta pendiente
- **WHEN** un usuario calidad la aprueba
- **THEN** la revisión se convierte en la versión activa

### Requirement: Carpetas de checklist
Las plantillas SHALL poder organizarse en carpetas jerárquicas opcionales.

#### Scenario: Mover plantilla a carpeta
- **GIVEN** una plantilla sin carpeta
- **WHEN** se mueve a la carpeta «Seguridad»
- **THEN** aparece dentro de esa carpeta en la lista

### Requirement: Checklist en cierre de tarea
Al cerrar una tarea con checklist asignado, el sistema SHALL validar completitud.

#### Scenario: Tarea con checklist incompleto
- **GIVEN** una tarea con checklist asignado con items pendientes
- **WHEN** se intenta completar la tarea
- **THEN** se muestra advertencia de checklist incompleto
