# Flujos (Workflows)

## Purpose
Automatización de acciones (notificaciones, emails) ante eventos del sistema. Solo admin.

## Requirements

### Requirement: Triggers disponibles
El sistema SHALL soportar triggers: tarea creada/completada/asignada, cambio de estado, nota, solicitud pública, revisión propuesta/aprobada/rechazada.

#### Scenario: Trigger de tarea creada
- **GIVEN** un flujo activo con trigger «tarea creada»
- **WHEN** se crea una nueva tarea
- **THEN** el motor ejecuta las acciones del flujo

### Requirement: Acciones de notificación y email
Las acciones SHALL ser notificación in-app o email vía SMTP.

#### Scenario: Acción de email
- **GIVEN** un flujo con acción email configurada
- **WHEN** se dispara el trigger
- **THEN** se envía el email al destinatario con las variables resueltas

### Requirement: Wizard de 3 pasos
Crear/editar flujo SHALL usar wizard: Datos → Cuando → Entonces.

#### Scenario: Crear flujo completo
- **GIVEN** un admin en `/flujos/new`
- **WHEN** completa los 3 pasos y guarda
- **THEN** el flujo queda activo

### Requirement: Probar acción
Cada acción SHALL tener botón «Probar» que envía al usuario actual con datos de ejemplo.

#### Scenario: Probar notificación
- **GIVEN** un admin editando un flujo
- **WHEN** presiona «Probar» en una acción de notificación
- **THEN** recibe una notificación in-app con variables de ejemplo

### Requirement: Canvas de flujo
El flujo guardado SHALL visualizarse como canvas read-only.

#### Scenario: Ver canvas
- **GIVEN** un flujo guardado
- **WHEN** un admin navega a `/flujos/{id}`
- **THEN** ve el canvas con nodos de trigger y acciones

### Requirement: Template variables
Título y cuerpo SHALL autocompletar `{{variables}}` al escribir `{`.

#### Scenario: Autocompletar variable
- **GIVEN** un admin editando el cuerpo de una acción
- **WHEN** escribe `{`
- **THEN** aparece lista de variables disponibles
