# Búsqueda Global

## Purpose
Búsqueda unificada por tipos de entidad con filtrado por rol.

## Requirements

### Requirement: Búsqueda unificada
`GET /api/search` SHALL agrupar resultados por tipo (tareas, eventos, máquinas, checklists, personas, archivos).

#### Scenario: Buscar término
- **GIVEN** un usuario autenticado
- **WHEN** busca "bomba" en el buscador global
- **THEN** ve resultados agrupados por categoría

### Requirement: Resultados por rol
Los tipos de resultado SHALL filtrarse según el rol del usuario.

#### Scenario: Técnico busca
- **GIVEN** un usuario con rol `tecnico`
- **WHEN** busca "bomba"
- **THEN** solo ve resultados de tipos permitidos para su rol

### Requirement: Página de resultados
Enter en el buscador global SHALL navegar a `/buscar` con resultados agrupados con iconos y colores.

#### Scenario: Navegar a resultados completos
- **GIVEN** un usuario en el buscador del header
- **WHEN** presiona Enter
- **THEN** navega a `/buscar` con los resultados expandidos
