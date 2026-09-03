# Documentación de Producto

## Purpose
Guía in-app en español mexicano con mocks visuales y datos de ejemplo.

## Requirements

### Requirement: Guía in-app
Ruta `/documentacion` SHALL estar disponible para admin, técnico y calidad via sidebar «Ayuda».

#### Scenario: Técnico accede a documentación
- **GIVEN** un usuario con rol `tecnico`
- **WHEN** navega a `/documentacion`
- **THEN** ve el índice de secciones de la guía

### Requirement: Secciones de documentación
La guía SHALL incluir secciones: Qué es MSA, Roles, Tareas, Calendario, Máquinas, Checklists, Solicitudes, Flujos, App móvil, Búsqueda.

#### Scenario: Navegar a sección
- **GIVEN** un usuario en `/documentacion`
- **WHEN** selecciona la sección «Tareas»
- **THEN** ve el contenido detallado de esa sección con mocks visuales

### Requirement: Mocks visuales
Cada sección SHALL incluir componentes con datos de ejemplo e imágenes ilustrativas.

#### Scenario: Ver mock de Kanban
- **GIVEN** un usuario en la sección «Tareas» de la documentación
- **WHEN** la página carga
- **THEN** ve un tablero Kanban con datos ficticios
