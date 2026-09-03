# App Móvil

## Purpose
App Expo (Android) para técnicos con misma API que la web, visibilidad de tareas por fecha y actualizador in-app.

## Requirements

### Requirement: Misma API que web
La app SHALL usar `fetch` con `credentials: "include"` contra la API web.

#### Scenario: Login desde app
- **GIVEN** un técnico en la app móvil
- **WHEN** ingresa credenciales válidas
- **THEN** la sesión se establece via cookie

### Requirement: Visibilidad de tareas por fecha
La app solo SHALL listar tareas cuya start_date (o due_date) es hoy o antes en America/Monterrey.

#### Scenario: Tarea futura no visible
- **GIVEN** una tarea con start_date mañana
- **WHEN** el técnico abre la lista
- **THEN** la tarea NO aparece

### Requirement: Colores de estado
Los colores de estado SHALL cargarse desde `GET /api/app-settings/work-order-status-colors`.

#### Scenario: Cargar colores
- **GIVEN** la app iniciada
- **WHEN** carga la lista de tareas
- **THEN** los badges de estado usan los colores del servidor

### Requirement: Actualizador in-app
La app SHALL descargar APKs con progreso e instalar vía content URI.

#### Scenario: Actualización disponible
- **GIVEN** una versión nueva publicada
- **WHEN** la app detecta la actualización
- **THEN** muestra progreso de descarga y luego instala

### Requirement: Fotos y adjuntos
Checklist photo fields y adjuntos SHALL soportar cámara y galería.

#### Scenario: Adjuntar foto desde cámara
- **GIVEN** un técnico en un campo de foto de checklist
- **WHEN** toma una foto con la cámara
- **THEN** la foto se sube al servidor
