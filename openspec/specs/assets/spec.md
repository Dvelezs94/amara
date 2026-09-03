# Assets (Máquinas)

## Purpose
Explorador de activos, áreas, fotos de máquinas.

## Requirements

### Requirement: Explorer de activos
El sistema SHALL mostrar activos en `/assets` con explorador por áreas.

#### Scenario: Ver lista de activos
- **GIVEN** un usuario autenticado
- **WHEN** navega a `/assets`
- **THEN** ve los activos organizados por área

### Requirement: Áreas de activos
Áreas planas para agrupar máquinas con UI de crear/renombrar/eliminar.

#### Scenario: Crear área
- **GIVEN** un admin en `/assets`
- **WHEN** crea un área «Línea 1»
- **THEN** el área aparece en el explorador

### Requirement: Fotos de máquinas
Los activos SHALL soportar una imagen hero opcional almacenada en S3.

#### Scenario: Subir foto de máquina
- **GIVEN** un admin en detalle de activo
- **WHEN** sube una imagen válida
- **THEN** la imagen se muestra como thumbnail
