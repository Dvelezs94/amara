## ADDED Requirements

### Requirement: Resaltado de campos NO OK en checklist de tarea completada
Cuando una tarea está **completada** y su checklist se muestra en solo lectura en la web, cada campo de tipo dropdown cuyo valor contenga «NO OK» (sin distinguir mayúsculas) SHALL resaltarse en rojo de forma claramente distinguible de un valor «OK» u otro.

#### Scenario: Campo NO OK resaltado al ver tarea completada
- **GIVEN** una tarea con status `completed` y un checklist con un dropdown con valor «NO OK»
- **WHEN** un usuario abre el detalle de la tarea en la web
- **THEN** ese campo se muestra con resaltado rojo (texto y/o contenedor)
- **AND** los campos con valor «OK» no tienen ese resaltado

#### Scenario: Variantes de escritura de NO OK
- **GIVEN** una tarea completada con un dropdown con valor «no ok» o «No Ok»
- **WHEN** se muestra el checklist en solo lectura en la web
- **THEN** el campo se trata como NO OK y se resalta en rojo

#### Scenario: Campo sin NO OK sin resaltado
- **GIVEN** una tarea completada con un dropdown con valor «OK» o vacío
- **WHEN** se muestra el checklist en solo lectura en la web
- **THEN** el campo no se resalta en rojo por esta regla

#### Scenario: Tarea no completada sin resaltado obligatorio
- **GIVEN** una tarea pendiente, en progreso o cancelada
- **WHEN** se muestra el checklist
- **THEN** esta regla de resaltado rojo por NO OK no aplica (aunque el valor sea «NO OK»)
