## Purpose
Define cómo el dashboard comunica KPIs, listas y checklists del día: jerarquía visual, acentos de marca, estados vacíos y de carga, sin cambiar los datos ni el acceso por rol.

## ADDED Requirements

### Requirement: Tarjetas de KPI con jerarquía visual
Cada KPI del dashboard SHALL mostrarse en una tarjeta con icono, valor destacado y etiqueta de contexto (ventana de fechas). Los cinco indicadores existentes (MTTR, Inactividad, Paro de máquina, Planificado vs no planificado, OEE) MUST conservar el mismo significado numérico.

#### Scenario: Usuario ve KPIs diferenciados
- **GIVEN** un admin en `/dashboard` con datos de overview cargados
- **WHEN** mira la fila de indicadores
- **THEN** cada tarjeta tiene un icono, un valor grande y un subtítulo de contexto
- **AND** los valores coinciden con los KPIs del overview (mismas unidades)

### Requirement: Franja de contexto de la ventana
El dashboard SHALL mostrar una franja de contexto que indique el rango de fechas seleccionado y un resumen breve de esa ventana (por ejemplo días cubiertos), para que los KPIs no queden aislados.

#### Scenario: Rango visible junto a los números
- **GIVEN** un admin con el rango «Últimos 30 días»
- **WHEN** abre el dashboard
- **THEN** ve una franja que menciona el rango o los días de la ventana además del selector de fechas del header

### Requirement: Secciones de listas con cabecera e empty states
Las secciones Tareas, Eventos del calendario y Checklists del día SHALL tener cabecera con icono, título y acción secundaria cuando aplique. Si no hay ítems, MUST mostrar un estado vacío con mensaje en español y un enlace a la vista relacionada (tareas, calendario o checklists).

#### Scenario: Lista de tareas vacía
- **GIVEN** un admin en el dashboard con rango por defecto
- **WHEN** no hay tareas pendientes ni en progreso
- **THEN** ve un mensaje vacío (no una lista en blanco) y un enlace a `/tareas`

#### Scenario: Lista de eventos vacía
- **GIVEN** un admin en el dashboard con rango por defecto
- **WHEN** no hay eventos próximos
- **THEN** ve un mensaje vacío y un enlace a `/calendario`

#### Scenario: Checklists del día vacíos
- **GIVEN** un admin en la sección de checklists del día
- **WHEN** no hay checklists para la fecha seleccionada
- **THEN** ve un mensaje vacío y puede seguir navegando de día

### Requirement: Estado de carga perceptible
Mientras se cargan overview o checklists del día, el dashboard SHALL mostrar un estado de carga (esqueleto o texto de carga) en esas secciones en lugar de aparentar que no hay datos.

#### Scenario: Carga de KPIs
- **GIVEN** un admin que acaba de abrir `/dashboard`
- **WHEN** la petición de overview aún no termina
- **THEN** las tarjetas de KPI no se muestran como ceros definitivos sin indicación de carga

### Requirement: Interacción en filas de listas
Las filas de tareas, eventos y checklists SHALL responder al hover (fondo o borde) y el título de la tarea MUST seguir siendo un enlace a su detalle.

#### Scenario: Hover en una tarea
- **GIVEN** al menos una tarea pendiente en el dashboard
- **WHEN** el usuario pasa el puntero sobre la fila
- **THEN** la fila cambia de aspecto
- **AND** el título sigue enlazando a `/tareas/{id}`
