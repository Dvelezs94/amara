## Context

See proposal.md — Why. El dashboard vive en `app/(app)/dashboard/page.tsx` (KPIs, listas, widgets de analítica) y `DashboardChecklistsSection.tsx`. Los números salen de `GET /api/dashboard/overview` y `GET /api/dashboard/checklists`. Paleta: primary `#02257D`, accent `#F14C03`. El header ya tiene el selector de rango; las tarjetas KPI no lo reflejan visualmente.

## Goals / Non-Goals

**Goals:**
- Jerarquía visual clara (KPI → operaciones del día → gráficos)
- Presentación testeable en `lib/` (metadatos de KPI, textos de empty state)
- Consistencia entre listas y checklists del día
- Accesible: contraste, `aria-label` en iconos decorativos

**Non-Goals:**
- Nuevos KPIs, APIs o fórmulas
- Abrir `/dashboard` a técnico/calidad
- Animaciones pesadas o librerías de UI nuevas
- Rediseño de `AnalyticsChartCard` interno (solo cabecera/contenedor del bloque de gráficos)

## Decisions

### 1. Helper de presentación, no de negocio
**Decisión:** `lib/dashboard-presentation.ts` exporta:
- catálogo de los 5 KPIs (`id`, `title`, `hint`, `tone`: primary | accent | zinc)
- textos de empty state (`tareas`, `eventos`, `checklists`)
- formateo de la franja de contexto a partir de `windowDays` + rango `from`/`to`

**Alternativa:** Todo en JSX — descartado porque el proyecto exige tests de helpers puros.

### 2. Color de KPI por tono, no por umbral
**Decisión:** Cada KPI tiene un acento fijo (p. ej. OEE y planificado → primary; paro de máquina → accent; el resto → zinc/primary suave). No se colorea «rojo/verde» según umbral porque no hay umbrales de negocio definidos.
**Alternativa:** Semáforo por valor — se pospone hasta tener reglas de calidad.

### 3. Franja de contexto debajo del header, encima de KPIs
**Decisión:** Banner compacto (fondo primary-50 / borde primary-100) con el rango ya formateado (`formatDashboardRangeTrigger`) y `windowDays` cuando hay KPIs.
**Alternativa:** Duplicar el selector en el body — evitado; el header ya lo tiene.

### 4. Carga: skeleton CSS, no spinner
**Decisión:** Bloques `animate-pulse` de altura fija para KPI y listas mientras `loading === true`. Checklists del día ya tiene «Cargando…»; alinearlo a skeleton o mantener texto + skeleton de filas.
**Alternativa:** Skeleton library — no.

### 5. Empty states con CTA
**Decisión:** Icono + frase + `Link` a `/tareas`, `/calendario` o `/checklists` según sección. Checklists del día: CTA a `/checklists` (plantillas) porque la lista es por fecha, no un listado global de instancias.

### 6. Archivos
**Nuevos:** `lib/dashboard-presentation.ts`, `tests/unit/dashboard-presentation.test.ts`
**Modificados:** `app/(app)/dashboard/page.tsx`, `DashboardChecklistsSection.tsx`, `AGENTS.md` (párrafo del dashboard)

## Risks / Trade-offs

- **Clases Tailwind en lib/** → Mitigación: el helper solo devuelve tokens (`tone: "accent"`); las clases viven en el componente de página (como búsqueda global) para que el scanner de Tailwind las vea.
- **Más altura en viewport pequeño** → Mitigación: banner de una línea; KPIs siguen en grid 1/2/5 columnas.
- **Falsa alarma de «datos malos» por color accent en paro** → Mitigación: accent = marca, no semáforo; el hint del KPI no cambia.

## Migration Plan

Sin migración. Rollback = revertir UI y helper.
